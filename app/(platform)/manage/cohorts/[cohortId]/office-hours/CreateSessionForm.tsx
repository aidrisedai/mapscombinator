"use client";

import { useRef, useState, useTransition } from "react";
import { ActionForm, CheckboxField, TextField, type Result } from "@/components/ui/forms";
import { buttonClass, cx } from "@/components/ui/primitives";
import { createSessionsAction, previewSessionsAction } from "./actions";
import { SessionFields, type HostOption, type WeekOption } from "./SessionFields";

type Occ = { position: number; localDate: string; label: string; error: string | null };

export function CreateSessionForm({ cohortId, hosts, weeks, timezone, defaultDate }: { cohortId: string; hosts: HostOption[]; weeks: WeekOption[]; timezone: string; defaultDate: string }) {
  const [repeat, setRepeat] = useState(false);
  const [preview, setPreview] = useState<Occ[] | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const snapshot = useRef<FormData | null>(null);

  async function runPreview(fd: FormData): Promise<Result> {
    setCreateError(null);
    const fe: Record<string, string> = {};
    const mode = String(fd.get("mode") ?? "");
    if (!String(fd.get("title") ?? "").trim()) fe.title = "Title is required.";
    if (mode !== "in_person" && !String(fd.get("meetingUrl") ?? "").trim()) fe.meetingUrl = "Required for online and hybrid sessions.";
    if (mode !== "online" && !String(fd.get("location") ?? "").trim()) fe.location = "Required for in-person and hybrid sessions.";
    if (Object.keys(fe).length) {
      setPreview(null);
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fe };
    }
    const r = await previewSessionsAction(fd);
    if (r.ok) {
      snapshot.current = fd;
      setPreview(r.data as Occ[]);
    } else setPreview(null);
    return r;
  }

  function create() {
    const fd = snapshot.current;
    if (!fd || pending) return;
    start(async () => {
      try {
        const r = await createSessionsAction(fd);
        if (!r.ok) setCreateError(r.error);
      } catch (err) {
        if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
        setCreateError("We couldn't reach the server, so nothing was created. Try again.");
      }
    });
  }

  const bad = preview?.filter((o) => o.error).length ?? 0;

  return (
    <div className="space-y-6">
      <ActionForm action={runPreview} submitLabel="Preview dates" pendingLabel="Checking dates…" after="none" submitVariant="secondary" warnUnsaved>
        <div className="space-y-5" onChange={() => preview && setPreview(null)}>
          <input type="hidden" name="cohortId" value={cohortId} />
          <SessionFields hosts={hosts} weeks={weeks} timezone={timezone} defaults={{ date: defaultDate, startTime: "16:00" }} />
          <div className="rounded-md border border-line bg-cream/30 p-4">
            <div onChange={(e) => setRepeat((e.target as HTMLInputElement).checked)}>
              <CheckboxField name="repeatWeekly" label="Repeat weekly" hint="Creates separate sessions at the same local time each week — DST changes don't shift the wall-clock time." />
            </div>
            {repeat && (
              <div className="mt-3 max-w-xs">
                <TextField label="Number of occurrences" name="occurrences" type="number" min={1} max={52} defaultValue="4" required />
              </div>
            )}
          </div>
        </div>
      </ActionForm>
      {preview && (
        <section aria-labelledby="occ-h" className="space-y-3 rounded-lg border border-forest/30 bg-cream/40 p-4">
          <h3 id="occ-h" className="font-semibold text-ink">
            {preview.length === 1 ? "1 session" : `${preview.length} sessions`} will be created as drafts
          </h3>
          <ol className="space-y-1.5 text-sm">
            {preview.map((o) => (
              <li key={o.position} className={cx("flex flex-wrap gap-x-2", o.error && "text-error")}>
                <span className="w-6 text-ink/50">{o.position}.</span>
                <span className="font-medium">{o.label}</span>
                {o.error && <span>— {o.error}</span>}
              </li>
            ))}
          </ol>
          {bad > 0 && <p className="text-sm text-error">Fix the date, time or number of occurrences so every occurrence is valid, then preview again.</p>}
          {createError && <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{createError}</p>}
          <p className="text-xs text-ink/60">Drafts are visible only to administrators. You&apos;ll publish them on the next screen, with an optional email.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={create} disabled={pending || bad > 0} className={buttonClass("primary")}>
              {pending ? "Creating…" : "Create as drafts"}
            </button>
            <button type="button" onClick={() => setPreview(null)} disabled={pending} className={buttonClass("ghost")}>
              Keep editing
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
