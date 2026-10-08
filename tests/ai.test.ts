import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { __setAiClientForTests, runAssistant } from "@/lib/server/ai/assistant";
import { sql } from "@/lib/server/db";
import { createStartup } from "@/lib/server/domain/startups";
import { saveUpdate } from "@/lib/server/domain/updates";
import { todayIn } from "@/lib/time";
import { account, activeCohort, grant, org } from "./helpers";

process.env.ANTHROPIC_API_KEY = "test-key";

type Captured = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
let captured: Captured[] = [];
let nextReply: { text: string; stop_reason?: string } = { text: "{}" };

function fakeClient() {
  return new Anthropic({
    apiKey: "test-key",
    maxRetries: 0,
    fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
      const headers: Record<string, string> = {};
      new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
      captured.push({ url: String(url), headers, body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({
          id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5",
          content: [{ type: "text", text: nextReply.text }],
          stop_reason: nextReply.stop_reason ?? "end_turn", stop_sequence: null,
          usage: { input_tokens: 120, output_tokens: 80 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
}

async function world() {
  const o = await org();
  const owner = await account(o, { owner: true });
  const f1 = await account(o, { name: "Fatima" });
  const f2 = await account(o, { name: "Other" });
  const C = await activeCohort(owner);
  const e1 = await createStartup(owner, C.id, { name: "Acme", description: "a", contactName: "F", contactEmail: f1.email });
  const e2 = await createStartup(owner, C.id, { name: "Rival", description: "r", contactName: "O", contactEmail: f2.email });
  await grant(owner, f1, "founder", C.id, e1);
  await grant(owner, f2, "founder", C.id, e2);
  return { owner, f1, f2, C, e1, e2 };
}

beforeEach(() => {
  captured = [];
  __setAiClientForTests(fakeClient());
});

describe("AI form assistant", () => {
  it("sends a structured-output request with fallbacks and returns only a draft", async () => {
    const { owner, C } = await world();
    nextReply = { text: JSON.stringify({ reply: "Drafted Week 3.", draft: { title: "Customer discovery", objective: "Talk to users", instructions: "- 10 interviews", deliverable: "Insights" } }) };
    const r = await runAssistant(owner, "week", { cohortId: C.id, weekNumber: 3 }, [{ role: "user", content: "Week 3 is customer discovery" }]);
    expect(r.draft).toMatchObject({ title: "Customer discovery" });
    const req = captured[0];
    expect(req.url).toContain("/v1/messages");
    expect(req.headers["anthropic-beta"]).toContain("server-side-fallback-2026-07-01");
    expect(req.body.model).toBe("claude-opus-5-5");
    expect(req.body.fallbacks).toBe("default");
    expect(req.body.thinking).toBeUndefined();
    const oc = req.body.output_config as { effort: string; format: { type: string; schema: { properties: Record<string, unknown> } } };
    expect(oc.effort).toBe("low");
    expect(oc.format.type).toBe("json_schema");
    expect(Object.keys(oc.format.schema.properties)).toEqual(["reply", "draft"]);
    // Context is trusted platform data; the person's text comes last as a user turn.
    const msgs = req.body.messages as { role: string; content: string }[];
    expect(msgs[0].content).toContain("Drafting Week 3");
    expect(msgs.at(-1)).toEqual({ role: "user", content: "Week 3 is customer discovery" });
    // Nothing is written except an audit row (no content, just usage).
    const [a] = await sql()`select summary from audit_events where action = 'ai.assist' order by created_at desc limit 1`;
    expect(a.summary).toMatchObject({ kind: "week", input_tokens: 120 });
  });

  it("enforces who may use each assistant", async () => {
    const { f1, f2, C, e1 } = await world();
    nextReply = { text: JSON.stringify({ reply: "ok", draft: null }) };
    await expect(runAssistant(f1, "startups", { cohortId: C.id }, [{ role: "user", content: "add startups" }])).rejects.toThrow(/administrators/);
    await expect(runAssistant(f2, "daily", { cohortId: C.id, enrollmentId: e1 }, [{ role: "user", content: "x" }])).rejects.toThrow(/founders/);
    await expect(runAssistant(f1, "cohort", {}, [{ role: "user", content: "x" }])).rejects.toThrow(/owners/);
    expect(captured).toHaveLength(0); // refused before any AI call
  });

  it("gives founders only their own team's notes as context", async () => {
    const { f1, f2, C, e1, e2 } = await world();
    const today = todayIn(C.timezone);
    await saveUpdate(f1, C.id, { enrollmentId: e1, kind: "daily", reportDate: today, content: { moved: "OUR SECRET PROGRESS", next: "n" }, lockVersion: null, intent: "draft" });
    await saveUpdate(f2, C.id, { enrollmentId: e2, kind: "daily", reportDate: today, content: { moved: "RIVAL PROGRESS", next: "n" }, lockVersion: null, intent: "publish" });
    nextReply = { text: JSON.stringify({ reply: "Drafted.", draft: { accomplished: "a", learned: "l", nextCommitments: "n", blockers: "", link: "" } }) };
    await runAssistant(f1, "weekly", { cohortId: C.id, enrollmentId: e1, weekNumber: 3 }, [{ role: "user", content: "summarize my week" }]);
    const ctx = (captured[0].body.messages as { content: string }[])[0].content;
    expect(ctx).toContain("OUR SECRET PROGRESS");
    expect(ctx).not.toContain("RIVAL PROGRESS");
  });

  it("handles refusals and truncation without returning a draft", async () => {
    const { owner, C } = await world();
    nextReply = { text: "", stop_reason: "refusal" };
    const r = await runAssistant(owner, "announcement", { cohortId: C.id }, [{ role: "user", content: "x" }]);
    expect(r.draft).toBeNull();
    expect(r.reply).toMatch(/can't help|couldn't draft/);
    nextReply = { text: '{"reply": "cut off mid', stop_reason: "max_tokens" };
    const t = await runAssistant(owner, "announcement", { cohortId: C.id }, [{ role: "user", content: "x" }]);
    expect(t.draft).toBeNull();
    await expect(runAssistant(owner, "announcement", { cohortId: C.id }, [])).rejects.toThrow(/Type a message/);
  });
});
