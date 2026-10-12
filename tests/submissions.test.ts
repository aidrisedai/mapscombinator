import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "@/lib/server/db";
import { getSubmission, listSubmissions, submitPublicForm, updateSubmission } from "@/lib/server/domain/submissions";
import { account, org } from "./helpers";

const ip = () => `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const contribution = (over: Record<string, unknown> = {}) => ({
  kind: "contribution",
  name: "Jane Doe",
  email: `jane-${randomUUID().slice(0, 6)}@example.org`,
  city: "Seattle",
  contribution: "Sponsor or partner",
  organization: "Acme Clinics",
  details: "We could fund Demo Day.",
  consent: true,
  sourcePage: "/get-involved",
  ...over,
});

describe("public website submissions", () => {
  it("stores a Get Involved offer and emails the program inbox with a clear subject and reply-to", async () => {
    const input = contribution();
    const { id } = await submitPublicForm(input, ip());
    const [row] = await sql()`select * from public_submissions where id = ${id}`;
    expect(row).toMatchObject({ kind: "contribution", category: "Sponsor / partner", name: "Jane Doe", status: "new", consent: true });
    expect(row.answers.map((a: { label: string }) => a.label)).toEqual(["City", "How they'd contribute", "Organization", "Area of expertise", "Details"]);
    expect(row.answers[2].value).toBe("Acme Clinics");
    const [mail] = await sql()`select * from email_outbox where related_type = 'public_submission' and related_id = ${id}`;
    expect(mail.recipient_email).toBe("mapscombinator@gmail.com");
    expect(mail.payload.subject).toBe("[Get Involved] Sponsor / partner — Jane Doe (Acme Clinics)");
    expect(mail.payload.replyTo).toBe(input.email);
    expect(mail.payload.body).toMatch(/We could fund Demo Day\./);
    expect(mail.payload.url).toContain(`/manage/submissions/${id}`);
  });

  it("stores Combinator interest with its own subject", async () => {
    const { id } = await submitPublicForm(
      { kind: "combinator_interest", name: "Sam Lee", email: `sam-${randomUUID().slice(0, 6)}@example.org`, city: "Tacoma", problem: "Clinic scheduling", stage: "Building a prototype", consent: true },
      ip(),
    );
    const [mail] = await sql()`select payload from email_outbox where related_id = ${id}`;
    expect(mail.payload.subject).toBe("[Combinator Interest] Sam Lee — Building a prototype");
  });

  it("validates input, drops bots silently and rate limits", async () => {
    const err = await submitPublicForm(contribution({ email: "nope", consent: false, contribution: "Something else" }), ip()).catch((e) => e);
    expect(Object.keys(err.fieldErrors ?? {})).toEqual(expect.arrayContaining(["email", "consent", "contribution"]));
    const bot = await submitPublicForm(contribution({ website: "http://spam.example" }), ip());
    expect(bot.id).toBeNull();
    const email = `rl-${randomUUID().slice(0, 6)}@example.org`;
    for (let i = 0; i < 5; i++) await submitPublicForm(contribution({ email }), ip());
    await expect(submitPublicForm(contribution({ email }), ip())).rejects.toThrow(/Too many/);
  });

  it("only platform owners can read and update submissions", async () => {
    const o = await org();
    const owner = await account(o, { owner: true });
    const someone = await account(o);
    const { id } = await submitPublicForm(contribution(), ip());
    expect((await listSubmissions(owner, {})).rows.some((r) => r.id === id)).toBe(true);
    await expect(listSubmissions(someone, {})).rejects.toThrow(/owners/);
    await expect(getSubmission(someone, id!)).rejects.toThrow();
    await updateSubmission(owner, id!, { status: "contacted", note: "Called them" });
    expect(await getSubmission(owner, id!)).toMatchObject({ status: "contacted", admin_note: "Called them", handled_by: owner.id });
    await expect(updateSubmission(someone, id!, { status: "done" })).rejects.toThrow();
  });
});
