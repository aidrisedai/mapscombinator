"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { aiAssistAction, saveDraftStartupsAction } from "@/app/(platform)/_ai/actions";
import { inputClass } from "@/components/ui/forms";
import { buttonClass, cx } from "@/components/ui/primitives";

type Kind =
  | "cohort" | "startups" | "invites" | "week" | "session" | "announcement"
  | "daily" | "weekly" | "startupProfile" | "mentorProfile" | "booking" | "email";
type Ctx = { cohortId?: string; enrollmentId?: string; mentorId?: string; weekNumber?: number };
type Turn = { role: "user" | "assistant"; content: string };
type Draft = Record<string, unknown>;
type StartupDraft = { name: string; description: string; website: string; contactName: string; contactEmail: string; cofounders: { name: string; email: string }[] };
type InviteDraft = { role: "mentor" | "viewer" | "admin"; name: string; email: string };

const nativeSetter = (el: Element) =>
  Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
    "value",
  )!.set!;

/**
 * Writes values into a rendered form by input name, the same way typing
 * would (works for controlled and uncontrolled React inputs). It never
 * submits: the person reviews and presses the form's own button.
 */
async function fillForm(root: Element, values: Draft): Promise<number> {
  let filled = 0;
  const apply = () => {
    let n = 0;
    for (const [name, raw] of Object.entries(values)) {
      // Blank means "unknown" — never wipe what's already in the form.
      if (raw === null || raw === undefined || raw === "" || typeof raw === "object") continue;
      const els = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${CSS.escape(name)}"]`);
      for (const el of els) {
        if (el instanceof HTMLInputElement && (el.type === "hidden" || el.type === "file")) continue;
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
          if (el.checked !== Boolean(raw)) el.click();
          n++;
        } else if (el instanceof HTMLInputElement && el.type === "radio") {
          if (el.value === String(raw) && !el.checked) el.click();
          if (el.value === String(raw)) n++;
        } else {
          const v = String(raw);
          if (el instanceof HTMLSelectElement && ![...el.options].some((o) => o.value === v)) continue;
          if (el.value === v) {
            n++;
            continue;
          }
          nativeSetter(el).call(el, v);
          el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
          n++;
        }
      }
    }
    return n;
  };
  filled = apply();
  // Some fields only appear after another changes (format, repeat weekly).
  await new Promise((r) => setTimeout(r, 80));
  filled = Math.max(filled, apply());
  root.scrollIntoView({ behavior: "smooth", block: "start" });
  return filled;
}

const LABELS: Record<string, string> = {
  title: "Title", objective: "Objective", instructions: "Expected work", deliverable: "Deliverable", body: "Message", link: "Link",
  moved: "Moved forward", next: "Next", blockers: "Blockers", accomplished: "Accomplished", learned: "Learned", nextCommitments: "Next week",
  name: "Name", description: "Description", website: "Website", startDate: "Start date", weekCount: "Weeks", timezone: "Timezone",
  supportEmail: "Support email", hostName: "Host", date: "Date", startTime: "Start time", durationMinutes: "Minutes", mode: "Format",
  meetingUrl: "Meeting link", location: "Location", preparation: "Preparation", repeatWeekly: "Repeats weekly", occurrences: "Occurrences",
  bio: "Bio", expertise: "Expertise", meetingInstructions: "Meeting instructions", topic: "Topic", helpNeeded: "Help needed",
};

export function AiAssistant({
  kind,
  ctx = {},
  target,
  configured,
  title = "Fill this with AI",
  intro,
  placeholder,
  audience = "admin",
}: {
  kind: Kind;
  ctx?: Ctx;
  /** CSS selector of the element that contains the form to fill. */
  target?: string;
  configured: boolean;
  title?: string;
  intro?: string;
  placeholder?: string;
  audience?: "admin" | "founder" | "mentor";
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [shown, setShown] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald/40 bg-emerald/5 px-4 py-2 text-sm font-semibold text-forest hover:border-forest hover:bg-emerald/10">
        <span aria-hidden="true">✦</span> {title}
      </button>
    );

  function send() {
    const msg = text.trim();
    if (!msg || pending) return;
    setError(null);
    setNotice(null);
    const next: Turn[] = [...turns, { role: "user", content: msg }];
    start(async () => {
      let r;
      try {
        r = await aiAssistAction(kind, ctx, next);
      } catch {
        setError("Couldn't reach the server. Your message is still here — try again.");
        return;
      }
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const { reply, draft: d } = r.data as { reply: string; draft: Draft | null };
      setTurns([...next, { role: "assistant", content: JSON.stringify({ reply, draft: d }) }]);
      setShown((s) => [...s, { role: "user", text: msg }, { role: "assistant", text: reply }]);
      if (d) setDraft(d);
      setText("");
      inputRef.current?.focus();
    });
  }

  async function putInForm(values: Draft) {
    const root = target ? document.querySelector(target) : null;
    if (!root) {
      setNotice("Open the form first (for example, pick a time), then press this again.");
      return;
    }
    const n = await fillForm(root, values);
    setNotice(n ? `Filled ${n} field${n === 1 ? "" : "s"}. Review everything, then use the form's own button to save${kind === "invites" ? " or preview the invitation" : ""}.` : "Couldn't find the matching fields on this page.");
  }

  return (
    <section aria-label="AI assistant" className="mb-6 rounded-lg border border-emerald/40 bg-emerald/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-forest"><span aria-hidden="true">✦ </span>{title}</h2>
          <p className="mt-0.5 text-xs text-ink/60">
            {intro ?? "Describe it in your own words or paste notes, a list or an email. I draft the form; nothing is saved or sent until you press the form's button."}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-ink/60 hover:text-forest">Close</button>
      </div>

      {!configured ? (
        <p className="mt-3 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink/70">
          The AI assistant isn&apos;t set up yet{audience === "admin" ? " — add ANTHROPIC_API_KEY to the server settings to turn it on" : ""}. You can fill in the form yourself.
        </p>
      ) : (
        <>
          {shown.length > 0 && (
            <ol className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 text-sm" aria-live="polite">
              {shown.map((m, i) => (
                <li key={i} className={cx("rounded-md px-3 py-2", m.role === "user" ? "ml-8 bg-paper border border-line" : "mr-8 bg-cream/70")}>
                  <span className="sr-only">{m.role === "user" ? "You: " : "Assistant: "}</span>
                  <span className="whitespace-pre-line">{m.text}</span>
                </li>
              ))}
            </ol>
          )}

          {draft && kind === "startups" && <StartupDrafts cohortId={ctx.cohortId!} draft={draft} onChange={setDraft} />}
          {draft && kind === "invites" && <InviteDrafts draft={draft} onUse={(row) => putInForm(row as unknown as Draft)} />}
          {draft && kind !== "startups" && kind !== "invites" && (
            <div className="mt-3 rounded-md border border-line bg-paper p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Draft</p>
              <dl className="mt-2 space-y-1.5 text-sm">
                {Object.entries(draft).filter(([, v]) => v !== "" && v !== null && v !== false).map(([k, v]) => (
                  <div key={k} className="grid gap-x-3 sm:grid-cols-[9rem_1fr]">
                    <dt className="text-ink/50">{LABELS[k] ?? k}</dt>
                    <dd className="whitespace-pre-line break-words">{String(v)}</dd>
                  </div>
                ))}
              </dl>
              <button type="button" onClick={() => putInForm(draft)} className={cx(buttonClass("primary", "sm"), "mt-3")}>
                Put this in the form
              </button>
            </div>
          )}

          {notice && <p role="status" className="mt-3 text-sm text-success">{notice}</p>}
          {error && <p role="alert" className="mt-3 rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{error}</p>}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="sr-only" htmlFor={`ai-${kind}`}>Message to the assistant</label>
            <textarea
              id={`ai-${kind}`}
              ref={inputRef}
              rows={shown.length ? 2 : 3}
              className={cx(inputClass, "resize-y")}
              placeholder={placeholder ?? "e.g. paste your notes here"}
              value={text}
              maxLength={12000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
              }}
            />
            <button type="button" onClick={send} disabled={pending || !text.trim()} className={buttonClass("primary")}>
              {pending ? "Drafting…" : shown.length ? "Send" : "Draft it"}
            </button>
          </div>
          <p className="mt-1.5 text-[0.7rem] text-ink/50">What you type here is sent to Anthropic&apos;s AI service to draft this form. AI can make mistakes — check names, emails and dates.</p>
        </>
      )}
    </section>
  );
}

function StartupDrafts({ cohortId, draft, onChange }: { cohortId: string; draft: Draft; onChange: (d: Draft) => void }) {
  const rows = ((draft.startups as StartupDraft[]) ?? []).map((r) => ({ ...r, cofounders: r.cofounders ?? [] }));
  const [pending, start] = useTransition();
  const [results, setResults] = useState<({ ok: boolean; enrollmentId?: string; error?: string } | undefined)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const set = (i: number, patch: Partial<StartupDraft>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange({ startups: next });
  };
  const remove = (i: number) => {
    onChange({ startups: rows.filter((_, j) => j !== i) });
    setResults((r) => r.filter((_, j) => j !== i));
  };
  const unsaved = rows.map((r, i) => ({ r, i })).filter(({ i }) => !results[i]?.ok);
  if (!rows.length) return null;
  return (
    <div className="mt-3 space-y-3">
      {rows.map((r, i) => {
        const res = results[i];
        return (
          <div key={i} className={cx("rounded-md border bg-paper p-3", res?.ok ? "border-emerald/40" : res ? "border-error/40" : "border-line")}>
            {res?.ok ? (
              <p className="text-sm">
                <span className="font-semibold">{r.name}</span> saved.{" "}
                <Link className="font-medium text-emerald underline" href={`/manage/cohorts/${cohortId}/startups/${res.enrollmentId}`}>Open to invite founders →</Link>
              </p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input aria-label="Startup name" className={inputClass} value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Startup name" />
                  <input aria-label="Website" className={inputClass} value={r.website} onChange={(e) => set(i, { website: e.target.value })} placeholder="https:// (optional)" />
                  <textarea aria-label="Short description" className={cx(inputClass, "sm:col-span-2")} rows={2} value={r.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="Short description" />
                  <input aria-label="Primary contact name" className={inputClass} value={r.contactName} onChange={(e) => set(i, { contactName: e.target.value })} placeholder="Primary contact name" />
                  <input aria-label="Primary contact email" className={inputClass} value={r.contactEmail} onChange={(e) => set(i, { contactEmail: e.target.value })} placeholder="Primary contact email" />
                </div>
                {r.cofounders.length > 0 && (
                  <p className="mt-2 text-xs text-ink/60">Cofounders: {r.cofounders.map((c) => `${c.name}${c.email ? ` <${c.email}>` : " (no email)"}`).join(", ")}</p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  {res && !res.ok ? <p className="text-xs text-error">{res.error}</p> : <span />}
                  <button type="button" onClick={() => remove(i)} className="text-xs font-medium text-ink/60 hover:text-error">Remove</button>
                </div>
              </>
            )}
          </div>
        );
      })}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {unsaved.length > 0 && (
        <button
          type="button"
          disabled={pending}
          className={buttonClass("primary")}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await saveDraftStartupsAction(cohortId, unsaved.map(({ r }) => r)).catch(() => null);
              if (!r) return setError("Couldn't reach the server. Nothing was lost — try again.");
              if (!r.ok) return setError(r.error);
              const next = [...results];
              unsaved.forEach(({ i }, k) => (next[i] = r.data[k]));
              setResults(next);
            })
          }
        >
          {pending ? "Saving…" : `Save ${unsaved.length} startup${unsaved.length === 1 ? "" : "s"} (no emails sent)`}
        </button>
      )}
    </div>
  );
}

function InviteDrafts({ draft, onUse }: { draft: Draft; onUse: (row: InviteDraft) => void }) {
  const rows = (draft.invites as InviteDraft[]) ?? [];
  if (!rows.length) return null;
  return (
    <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-paper">
      {rows.map((r, i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
          <span>
            <span className="font-medium">{r.name || "(no name)"}</span> · {r.email || <em className="text-error">email missing</em>} · <span className="text-ink/60">{r.role}</span>
          </span>
          <button type="button" onClick={() => onUse(r)} className={buttonClass("secondary", "sm")}>Use in invite form</button>
        </li>
      ))}
    </ul>
  );
}
