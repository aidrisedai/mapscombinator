"use client";

import { useRef, useState, useTransition } from "react";
import { CheckboxField, TextAreaField, TextField, inputClass, type Result } from "@/components/ui/forms";
import { Badge, buttonClass, cx } from "@/components/ui/primitives";
import {
  deleteSavedTemplateAction,
  previewAutoTemplateAction,
  previewMessageAction,
  resetAutoTemplateAction,
  saveAutoTemplateAction,
  saveSavedTemplateAction,
  sendMessageAction,
  testAutoTemplateAction,
} from "./actions";

type Status = { tone: "ok" | "error"; text: string; fieldErrors?: Record<string, string> } | null;

function useRun() {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  function run(label: string, fn: () => Promise<Result>, onDone: (r: Result) => void) {
    setBusy(label);
    start(async () => {
      let r: Result;
      try {
        r = await fn();
      } catch {
        r = { ok: false, error: "We couldn't reach the server. Your text is still here; try again." };
      }
      onDone(r);
      setBusy(null);
    });
  }
  return { pending, busy, run };
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  const errs = status.fieldErrors ? Object.values(status.fieldErrors) : [];
  return status.tone === "ok" ? (
    <p role="status" className="rounded-md border border-emerald/40 bg-emerald/5 px-3 py-2 text-sm text-success">{status.text}</p>
  ) : (
    <div role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
      {status.text}
      {errs.length > 0 && !errs.includes(status.text) && (
        <ul className="mt-1 list-disc pl-5">
          {errs.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmailPreview({ subject, html, note }: { subject: string; html: string; note?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="border-b border-line bg-cream/60 px-3 py-2 text-sm">
        <span className="text-ink/60">Subject: </span>
        <strong className="font-semibold">{subject}</strong>
        {note && <span className="block text-xs text-ink/60">{note}</span>}
      </div>
      <iframe title="Email preview" sandbox="" srcDoc={html} className="h-[28rem] w-full bg-white" />
    </div>
  );
}

const asStatus = (r: Result, ok?: string): Status =>
  r.ok ? { tone: "ok", text: ok ?? ((r.data as { message?: string } | undefined)?.message ?? "Done.") } : { tone: "error", text: r.error, fieldErrors: r.fieldErrors };

/** Editor for one automatic email (acceptance, welcome, …). */
export function TemplateEditor({ cohortId, kind, subject, body, custom, writable }: { cohortId: string; kind: string; subject: string; body: string; custom: boolean; writable: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string; sample: string } | null>(null);
  const { pending, busy, run } = useRun();
  const fd = () => {
    const f = new FormData(formRef.current!);
    f.set("cohortId", cohortId);
    f.set("kind", kind);
    return f;
  };
  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} onChange={() => setPreview(null)} className="space-y-4" noValidate>
      <TextField label="Subject" name="subject" defaultValue={subject} maxLength={200} required error={status?.fieldErrors?.subject} />
      <TextAreaField label="Message" name="body" defaultValue={body} maxLength={10000} rows={12} required error={status?.fieldErrors?.body} hint="Plain text. Blank lines start new paragraphs; lines starting with “- ” become a list; https:// links become clickable." />
      <StatusLine status={status} />
      {preview && <EmailPreview subject={preview.subject} html={preview.html} note={`Example filled in for ${preview.sample}.`} />}
      <div className="flex flex-wrap items-center gap-2">
        {writable && (
          <button type="button" disabled={pending} className={buttonClass("primary")} onClick={() => run("save", () => saveAutoTemplateAction(fd()), (r) => setStatus(asStatus(r)))}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          className={buttonClass("secondary")}
          onClick={() =>
            run("preview", () => previewAutoTemplateAction(fd()), (r) => {
              if (r.ok) {
                setPreview(r.data as { subject: string; html: string; sample: string });
                setStatus(null);
              } else setStatus(asStatus(r));
            })
          }
        >
          {busy === "preview" ? "Loading…" : "Preview"}
        </button>
        <button type="button" disabled={pending} className={buttonClass("secondary")} onClick={() => run("test", () => testAutoTemplateAction(fd()), (r) => setStatus(asStatus(r)))}>
          {busy === "test" ? "Sending…" : "Send test to me"}
        </button>
        {writable && custom && (
          <button
            type="button"
            disabled={pending}
            className={buttonClass("ghost")}
            onClick={() => {
              if (!window.confirm("Discard your wording and go back to the standard email?")) return;
              run("reset", () => resetAutoTemplateAction(fd()), (r) => {
                setStatus(asStatus(r));
                if (r.ok) window.location.reload();
              });
            }}
          >
            Reset to standard
          </button>
        )}
      </div>
    </form>
  );
}

type Startup = { id: string; name: string; hasFounders: boolean };
type Saved = { id: string; name: string; subject: string; body: string };
type PreviewData = {
  count: number;
  startups: number;
  viaContact: number;
  recipients: { email: string; name: string; startup: string; viaContact: boolean; kind: string }[];
  sample: { to: string; subject: string; html: string } | null;
};

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | null, value: string) {
  if (!el) return;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Compose a one-off email to all, some, or behind-schedule startups. */
export function MessageComposer({ cohortId, startups, saved, week, mentorCount }: { cohortId: string; startups: Startup[]; saved: Saved[]; week: number | null; mentorCount: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [audience, setAudience] = useState<"all" | "selected" | "missing_weekly">("all");
  const [status, setStatus] = useState<Status>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [key, setKey] = useState("");
  const { pending, busy, run } = useRun();
  const fd = () => {
    const f = new FormData(formRef.current!);
    f.set("cohortId", cohortId);
    return f;
  };
  const loadSaved = (id: string) => {
    const t = saved.find((x) => x.id === id);
    if (!t || !formRef.current) return;
    setNativeValue(formRef.current.elements.namedItem("subject") as HTMLInputElement, t.subject);
    setNativeValue(formRef.current.elements.namedItem("body") as HTMLTextAreaElement, t.body);
    setNativeValue(formRef.current.elements.namedItem("templateName") as HTMLInputElement, t.name);
    setPreview(null);
  };

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} onChange={() => setPreview(null)} className="space-y-5" noValidate>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">Send to</legend>
        {(
          [
            ["all", `All startups (${startups.length})`],
            ["selected", "Choose startups"],
            ["missing_weekly", week ? `Startups that haven't posted their Week ${week} weekly summary` : "Startups missing this week's summary (only during the program)"],
          ] as const
        ).map(([v, label]) => (
          <label key={v} className="flex items-start gap-2 text-sm">
            <input type="radio" name="audience" value={v} checked={audience === v} onChange={() => setAudience(v)} disabled={v === "missing_weekly" && !week} className="mt-1 accent-forest" />
            <span>{label}</span>
          </label>
        ))}
        {audience === "selected" && (
          <div className="ml-6 grid max-h-60 gap-1.5 overflow-y-auto rounded-md border border-line p-3 sm:grid-cols-2">
            {startups.map((s) => (
              <label key={s.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="enrollmentId" value={s.id} className="mt-1 accent-forest" />
                <span>
                  {s.name}
                  {!s.hasFounders && <span className="block text-xs text-ink/60">No founder account yet: goes to the contact email</span>}
                </span>
              </label>
            ))}
          </div>
        )}
        <div className="space-y-2 pt-2">
          {mentorCount > 0 && <CheckboxField name="includeMentors" label={`Also send to this cohort's mentors & advisors (${mentorCount})`} />}
          <CheckboxField name="copyMe" label="Send me a copy" />
        </div>
      </fieldset>

      {saved.length > 0 && (
        <div>
          <label htmlFor="saved-template" className="block text-sm font-semibold text-ink">Start from a saved template <span className="font-normal text-ink/50">(optional)</span></label>
          <select id="saved-template" className={cx(inputClass, "mt-1.5")} defaultValue="" onChange={(e) => loadSaved(e.target.value)}>
            <option value="">Choose…</option>
            {saved.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <TextField label="Subject" name="subject" maxLength={200} required error={status?.fieldErrors?.subject} placeholder="e.g. Demo day prep for {startup_name}" />
      <TextAreaField label="Message" name="body" maxLength={10000} rows={10} required error={status?.fieldErrors?.body} hint="Each person gets their own copy with the placeholders filled in. Replies go to the program support email." placeholder={"Hi {first_name},\n\n…"} />

      <details className="rounded-md border border-line/70 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-ink/80">Save as a reusable template</summary>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField label="Template name" name="templateName" maxLength={120} placeholder="e.g. Weekly summary reminder" />
          </div>
          <button type="button" disabled={pending} className={buttonClass("secondary", "sm")} onClick={() => run("saveTpl", () => saveSavedTemplateAction(fd()), (r) => setStatus(asStatus(r)))}>
            {busy === "saveTpl" ? "Saving…" : "Save template"}
          </button>
        </div>
      </details>

      <StatusLine status={status} />

      {preview && (
        <div className="space-y-3 rounded-md border border-forest/30 bg-forest/5 p-4">
          <p className="text-sm text-ink">
            <strong>{preview.count}</strong> {preview.count === 1 ? "person" : "people"} at <strong>{preview.startups}</strong> startup{preview.startups === 1 ? "" : "s"}
            {preview.viaContact > 0 && <> · {preview.viaContact} at a startup contact email (no founder account yet)</>}. Each gets a separate email; no one sees the others&apos; addresses.
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-forest">See recipients</summary>
            <ul className="mt-2 max-h-56 divide-y divide-line/60 overflow-y-auto">
              {preview.recipients.map((r) => (
                <li key={r.email} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="font-medium">{r.name}</span>
                  <span className="break-all text-ink/60">{r.email}</span>
                  {r.startup && <Badge tone="neutral">{r.startup}</Badge>}
                  {r.kind === "mentor" && <Badge tone="info">Mentor</Badge>}
                  {r.kind === "you" && <Badge tone="info">Your copy</Badge>}
                  {r.viaContact && <Badge tone="warn">Contact email</Badge>}
                </li>
              ))}
            </ul>
          </details>
          {preview.sample && <EmailPreview subject={preview.sample.subject} html={preview.sample.html} note={`As ${preview.sample.to} will see it.`} />}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          className={buttonClass(preview ? "secondary" : "primary")}
          onClick={() =>
            run("preview", () => previewMessageAction(fd()), (r) => {
              if (r.ok) {
                setPreview(r.data as PreviewData);
                setKey(crypto.randomUUID());
                setStatus(null);
              } else setStatus(asStatus(r));
            })
          }
        >
          {busy === "preview" ? "Checking…" : "Preview recipients and email"}
        </button>
        {preview && (
          <button
            type="button"
            disabled={pending || preview.count === 0}
            className={buttonClass("primary")}
            onClick={() => {
              const f = fd();
              f.set("idempotencyKey", key);
              run("send", () => sendMessageAction(f), (r) => {
                setStatus(asStatus(r));
                if (r.ok) {
                  setPreview(null);
                  setNativeValue(formRef.current?.elements.namedItem("subject") as HTMLInputElement, "");
                  setNativeValue(formRef.current?.elements.namedItem("body") as HTMLTextAreaElement, "");
                }
              });
            }}
          >
            {busy === "send" ? "Sending…" : preview.count === 0 ? "Nobody to send to" : `Send to ${preview.count} ${preview.count === 1 ? "person" : "people"}`}
          </button>
        )}
      </div>
    </form>
  );
}

export function DeleteSavedTemplate({ cohortId, id, name }: { cohortId: string; id: string; name: string }) {
  const { pending, run } = useRun();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("ghost", "sm")}
        onClick={() => {
          if (!window.confirm(`Delete the template “${name}”?`)) return;
          const f = new FormData();
          f.set("cohortId", cohortId);
          f.set("templateId", id);
          run("del", () => deleteSavedTemplateAction(f), (r) => setErr(r.ok ? null : r.error));
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {err && <span className="text-xs text-error">{err}</span>}
    </span>
  );
}
