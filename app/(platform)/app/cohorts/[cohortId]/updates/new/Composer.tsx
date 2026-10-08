"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { TextAreaField, TextField, inputClass, useUnsavedWarning } from "@/components/ui/forms";
import { Badge, buttonClass } from "@/components/ui/primitives";
import { saveUpdateAction, type SaveUpdateResponse } from "../actions";

type Kind = "daily" | "weekly";
type Fields = Record<string, string>;
type Existing = {
  id: string;
  state: "draft" | "published";
  content: Record<string, string | null>;
  lockVersion: number;
  updatedAt: string;
  lastPublishedAt: string | null;
  lastEditor: string;
  editedAfterPublish: boolean;
} | null;

const FIELDS: Record<Kind, { key: string; label: string; hint?: string; required: boolean; rows: number }[]> = {
  daily: [
    { key: "moved", label: "What moved forward today?", required: true, rows: 4, hint: "Progress, conversations, experiments — concrete beats polished." },
    { key: "next", label: "What's next?", required: true, rows: 3 },
    { key: "blockers", label: "Blocker or help needed", required: false, rows: 3 },
  ],
  weekly: [
    { key: "accomplished", label: "What did the team accomplish?", required: true, rows: 6 },
    { key: "learned", label: "What did the team learn?", required: true, rows: 5, hint: "About customers, the problem, the product, or yourselves." },
    { key: "nextCommitments", label: "Next week's commitments", required: true, rows: 5, hint: "These show up as reference in next week's summary." },
    { key: "blockers", label: "Blockers or help needed", required: false, rows: 3 },
  ],
};

function toFields(kind: Kind, c: Record<string, string | null> | undefined): Fields {
  const f: Fields = { link: c?.link ?? "" };
  for (const x of FIELDS[kind]) f[x.key] = c?.[x.key] ?? "";
  return f;
}

const time = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function Composer({
  cohortId,
  enrollmentId,
  kind,
  period,
  periodPicker,
  existing,
  limits,
  journalHref,
}: {
  cohortId: string;
  enrollmentId: string;
  kind: Kind;
  period: { reportDate?: string; weekNumber?: number };
  periodPicker: { kind: "date"; min: string; max: string; value: string; hrefBase: string } | { kind: "week"; max: number; value: number; hrefBase: string };
  existing: Existing;
  limits: Record<string, number>;
  journalHref: string;
}) {
  const router = useRouter();
  const serverFields = useMemo(() => toFields(kind, existing?.content), [kind, existing]);
  const [fields, setFields] = useState<Fields>(serverFields);
  const [lockVersion, setLockVersion] = useState<number | null>(existing?.lockVersion ?? null);
  const [state, setState] = useState<"absent" | "draft" | "published">(existing?.state ?? "absent");
  const [savedAt, setSavedAt] = useState<string | null>(existing?.updatedAt ?? null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<NonNullable<Extract<SaveUpdateResponse, { ok: false }>["current"]> | null>(null);
  const [restored, setRestored] = useState(false);
  const [pending, start] = useTransition();
  const backupKey = `maps:unsaved:${enrollmentId}:${kind}:${period.reportDate ?? period.weekNumber}`;
  const firstRender = useRef(true);
  useUnsavedWarning(dirty);

  // Per-browser safety net for unsaved text (never the source of truth).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(backupKey);
      if (!raw) return;
      const b = JSON.parse(raw) as { fields: Fields; at: string; base: number | null };
      const differs = Object.keys(b.fields).some((k) => (b.fields[k] ?? "") !== (serverFields[k] ?? ""));
      if (differs && b.base === (existing?.lockVersion ?? null)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage on mount
        setFields(b.fields);
        setDirty(true);
        setRestored(true);
      } else localStorage.removeItem(backupKey);
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!dirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(backupKey, JSON.stringify({ fields, at: new Date().toISOString(), base: lockVersion }));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [fields, dirty, backupKey, lockVersion]);

  function set(key: string, v: string) {
    setFields((f) => ({ ...f, [key]: v }));
    setDirty(true);
  }

  function save(intent: "draft" | "publish") {
    if (pending) return;
    setMessage(null);
    setFieldErrors({});
    start(async () => {
      let r: SaveUpdateResponse;
      try {
        r = await saveUpdateAction(cohortId, { enrollmentId, kind, ...period, content: fields, lockVersion, intent });
      } catch {
        setMessage({ tone: "error", text: "We couldn't reach the server. Your text is still here — check your connection and try again." });
        return;
      }
      if (r.ok) {
        setLockVersion(r.data.lockVersion);
        setState(r.data.state);
        setSavedAt(r.data.savedAt);
        setDirty(false);
        setConflict(null);
        setRestored(false);
        try {
          localStorage.removeItem(backupKey);
        } catch {
          /* ignore */
        }
        setMessage({ tone: "ok", text: r.data.state === "published" ? "Published. It's now visible to your cohort." : "Draft saved." });
      } else {
        if (r.code === "conflict" && r.current) setConflict(r.current);
        setFieldErrors(r.fieldErrors ?? {});
        setMessage({ tone: "error", text: r.error });
      }
    });
  }

  const overLimit = Object.entries(limits).some(([k, max]) => (fields[k] ?? "").length > max);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        {periodPicker.kind === "date" ? (
          <div>
            <label htmlFor="report-date" className="block text-sm font-semibold">Reporting date</label>
            <input
              id="report-date"
              type="date"
              className={`${inputClass} mt-1.5 w-auto`}
              min={periodPicker.min}
              max={periodPicker.max}
              value={periodPicker.value}
              onChange={(e) => {
                if (!e.target.value) return;
                if (dirty && !window.confirm("You have unsaved changes. Switch dates anyway?")) return;
                setDirty(false);
                router.push(periodPicker.hrefBase + e.target.value);
              }}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="report-week" className="block text-sm font-semibold">Program week</label>
            <select
              id="report-week"
              className={`${inputClass} mt-1.5 w-auto`}
              value={periodPicker.value}
              onChange={(e) => {
                if (dirty && !window.confirm("You have unsaved changes. Switch weeks anyway?")) return;
                setDirty(false);
                router.push(periodPicker.hrefBase + e.target.value);
              }}
            >
              {Array.from({ length: periodPicker.max }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>Week {n}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2 pb-2 text-sm">
          {state === "absent" && <Badge>Not started</Badge>}
          {state === "draft" && <Badge tone="draft">Private draft</Badge>}
          {state === "published" && <Badge tone="published">Published</Badge>}
          {savedAt && state !== "absent" && <span className="text-ink/60">Saved {time(savedAt)}{existing?.lastEditor ? ` · last edit by ${existing.lastEditor}` : ""}</span>}
        </div>
      </div>

      {restored && (
        <div role="status" className="rounded-md border border-[#f0c987] bg-[#fff8ec] px-4 py-3 text-sm">
          We restored text you hadn&apos;t saved yet from this browser. Save it, or{" "}
          <button
            className="font-semibold text-forest underline"
            onClick={() => {
              setFields(serverFields);
              setDirty(false);
              setRestored(false);
              try {
                localStorage.removeItem(backupKey);
              } catch {
                /* ignore */
              }
            }}
          >
            discard it
          </button>
          .
        </div>
      )}

      {conflict && (
        <div role="alert" className="rounded-lg border border-error/40 bg-error/5 p-4 text-sm">
          <p className="font-semibold">{conflict.editor} saved this update at {time(conflict.updatedAt)}.</p>
          <p className="mt-1 text-ink/80">Your text is unchanged below. Compare with their version and choose what to keep.</p>
          <dl className="mt-3 space-y-2">
            {FIELDS[kind].map((f) => (
              <div key={f.key}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">{f.label}</dt>
                <dd className="whitespace-pre-line text-ink/90">{conflict.content[f.key] || <em className="text-ink/50">empty</em>}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className={buttonClass("secondary", "sm")}
              onClick={() => {
                setFields(toFields(kind, conflict.content));
                setLockVersion(conflict.lockVersion);
                setState(conflict.state as "draft" | "published");
                setConflict(null);
                setDirty(false);
                setMessage(null);
              }}
            >
              Use their version
            </button>
            <button
              className={buttonClass("secondary", "sm")}
              onClick={() => {
                setLockVersion(conflict.lockVersion);
                setState(conflict.state as "draft" | "published");
                setConflict(null);
                setMessage({ tone: "ok", text: "Keeping your text. Save again to replace their version (theirs stays in the revision history)." });
              }}
            >
              Keep mine
            </button>
          </div>
        </div>
      )}

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save(state === "published" ? "publish" : "draft");
        }}
        noValidate
      >
        {FIELDS[kind].map((f) => (
          <TextAreaField
            key={f.key}
            label={f.label}
            name={f.key}
            rows={f.rows}
            hint={f.hint}
            required={f.required}
            optional={!f.required}
            maxLength={limits[f.key]}
            value={fields[f.key] ?? ""}
            onValueChange={(v) => set(f.key, v)}
            error={fieldErrors[f.key]}
          />
        ))}
        <TextField
          label="Evidence or demo link"
          name="link"
          type="url"
          inputMode="url"
          placeholder="https://"
          optional
          value={fields.link ?? ""}
          onChange={(e) => set("link", e.target.value)}
          hint="A full https:// link to a demo, doc, or screenshot."
          error={fieldErrors.link}
        />

        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error" : "rounded-md border border-emerald/40 bg-emerald/5 px-3 py-2 text-sm text-success"}>
            {message.text}
          </p>
        )}

        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
          {state === "published" ? (
            <button type="button" disabled={pending || overLimit} onClick={() => save("publish")} className={buttonClass("primary")}>
              {pending ? "Saving…" : "Save published changes"}
            </button>
          ) : (
            <>
              <button type="button" disabled={pending || overLimit} onClick={() => save("publish")} className={buttonClass("primary")}>
                {pending ? "Saving…" : "Publish to cohort"}
              </button>
              <button type="button" disabled={pending || overLimit} onClick={() => save("draft")} className={buttonClass("secondary")}>
                Save draft
              </button>
            </>
          )}
          <p className="text-xs text-ink/60">
            {state === "published"
              ? "Stays published. The previous version is kept in the revision history."
              : "Publishing makes this visible to everyone in your cohort."}
          </p>
        </div>
      </form>
      {state !== "absent" && (
        <p className="text-sm">
          <Link href={journalHref} className="font-medium text-emerald hover:text-forest">See your team&apos;s timeline →</Link>
        </p>
      )}
    </div>
  );
}
