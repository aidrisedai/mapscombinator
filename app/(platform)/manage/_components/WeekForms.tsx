"use client";

import { useRouter } from "next/navigation";
import { startTransition, useRef, useState, useTransition } from "react";
import { ActionButton, ActionForm, TextAreaField, TextField, type Result } from "@/components/ui/forms";
import { buttonClass, cx } from "@/components/ui/primitives";
import { addLinkResourceAction, publishWeekAction, saveWeekDraftAction, unpublishWeekAction } from "../actions";

type Content = { title: string; objective: string; instructions: string; deliverable: string };

export function WeekEditor({ cohortId, week, content }: { cohortId: string; week: number; content: Content }) {
  const [title, setTitle] = useState(content.title);
  return (
    <ActionForm
      action={saveWeekDraftAction}
      submitLabel="Save draft"
      pendingLabel="Saving draft…"
      successMessage="Draft saved. It isn't visible to founders until you publish, and no email was sent."
      warnUnsaved
      footer={<span className="text-xs text-ink/60">Saving a draft doesn&apos;t expose content or send email.</span>}
    >
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="week" value={String(week)} />
      <TextField
        label="Title / topic"
        name="title"
        maxLength={160}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        hint={`${title.length} / 160 · required to publish`}
      />
      <TextAreaField label="Objective" name="objective" maxLength={1000} rows={3} defaultValue={content.objective} hint="One or two sentences on what teams should get out of this week." />
      <TextAreaField
        label="Expected work / checklist"
        name="instructions"
        maxLength={8000}
        rows={8}
        defaultValue={content.instructions}
        hint="Plain text. Start lines with “- ” to make a checklist; leave a blank line between paragraphs."
      />
      <TextAreaField label="Deliverable" name="deliverable" maxLength={2000} rows={3} defaultValue={content.deliverable} hint="What teams should bring or share by the end of the week." />
    </ActionForm>
  );
}

async function call(action: (fd: FormData) => Promise<Result>, fields: Record<string, string>): Promise<Result> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  try {
    return await action(fd);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    return { ok: false, error: "We couldn't reach the server. Nothing was published. Try again." };
  }
}

export function PublishPanel({
  cohortId,
  week,
  state,
  hasContent,
  hasUnpublishedChanges,
  recipients,
}: {
  cohortId: string;
  week: number;
  state: string;
  hasContent: boolean;
  hasUnpublishedChanges: boolean;
  recipients: number;
}) {
  const [pending, start] = useTransition();
  const [send, setSend] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const published = state === "published";
  const canPublish = hasContent && (!published || hasUnpublishedChanges);
  const people = `${recipients} ${recipients === 1 ? "person" : "people"}`;

  function publish() {
    const prompt = send
      ? `Publish Week ${week} and email ${people} in this cohort? Founders will see it right away.`
      : `Publish Week ${week}? Founders will see it right away. No email will be sent.`;
    if (!window.confirm(prompt)) return;
    start(async () => {
      const r = await call(publishWeekAction, { cohortId, week: String(week), sendEmail: send ? "1" : "" });
      if (r.ok) {
        const queued = (r.data as { queued?: number } | undefined)?.queued ?? 0;
        setMessage({ ok: true, text: send ? `Published. ${queued} ${queued === 1 ? "email" : "emails"} queued for delivery; check the Delivery tab for status.` : "Published. No email was sent." });
        setSend(false);
        // refreshed by the server action
      } else setMessage({ ok: false, text: r.error });
    });
  }

  return (
    <div className="space-y-4">
      {!hasContent && <p className="text-sm text-ink/70">Save a draft with a title first. Then you can publish it here.</p>}
      {published && !hasUnpublishedChanges && <p className="text-sm text-ink/70">The published version is up to date with the latest draft.</p>}
      {published && hasUnpublishedChanges && <p className="text-sm text-ink/70">You have saved changes that founders don&apos;t see yet. Publishing replaces the current version and shows it as updated.</p>}
      {canPublish && (
        <>
          <p className="text-xs text-ink/60">Publishing uses the last <strong>saved</strong> draft. Save your edits above first.</p>
          <div className="flex items-start gap-3">
            <input id={`send-${week}`} type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} className="mt-1 h-4 w-4 rounded border-line accent-forest" />
            <label htmlFor={`send-${week}`} className="text-sm text-ink">
              <span className="font-medium">Send email to cohort</span>
              <span className="block text-xs text-ink/60">
                {people}{" "}with access to this cohort (including you if you&apos;re a member). One message each; addresses aren&apos;t shared.
              </span>
            </label>
          </div>
          <button type="button" disabled={pending} onClick={publish} className={buttonClass("primary")}>
            {pending ? "Publishing…" : published ? "Publish changes" : send ? "Publish and email" : "Publish"}
          </button>
        </>
      )}
      {message && (
        <p role={message.ok ? "status" : "alert"} className={cx("rounded-md border px-3 py-2 text-sm", message.ok ? "border-emerald/40 bg-emerald/5 text-success" : "border-error/40 bg-error/5 text-error")}>
          {message.text}
        </p>
      )}
      {published && (
        <div className="border-t border-line/60 pt-4">
          <p className="mb-2 text-xs text-ink/60">Unpublishing hides the week from founders. Its history and related posts are kept, and you can publish again.</p>
          <ActionButton
            action={unpublishWeekAction}
            fields={{ cohortId, week: String(week) }}
            label="Unpublish"
            pendingLabel="Unpublishing…"
            variant="danger"
            confirmMessage={`Unpublish Week ${week}? Founders will no longer see it.`}
          />
        </div>
      )}
    </div>
  );
}

export function AddLinkForm({ cohortId, week }: { cohortId: string; week: number }) {
  return (
    <ActionForm action={addLinkResourceAction} submitLabel="Add link" pendingLabel="Adding…" after="reset" successMessage="Link added." submitVariant="secondary">
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="week" value={String(week)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Label" name="label" required maxLength={160} placeholder="e.g. Customer interview guide" />
        <TextField label="Link" name="url" type="url" required placeholder="https://" />
      </div>
      <p className="text-xs text-ink/60">A shared link keeps the external provider&apos;s permissions (for example a Google Drive sharing setting). The platform doesn&apos;t grant access to it.</p>
    </ActionForm>
  );
}

const ALLOWED = [".pdf", ".pptx"];

/** Multipart upload to /api/upload with progress. Used for new files and replacements. */
export function UploadForm({ cohortId, week, maxMib, replacesId, replacesLabel, onDone }: { cohortId: string; week: number; maxMib: number; replacesId?: string; replacesLabel?: string; onDone?: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(replacesLabel ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const busy = progress !== null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setDone(false);
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose a PDF or PowerPoint (.pptx) file.");
    const lower = file.name.toLowerCase();
    if (!ALLOWED.some((x) => lower.endsWith(x))) return setError("Only PDF and PowerPoint (.pptx) files can be uploaded.");
    if (file.size > maxMib * 1048576) return setError(`That file is larger than ${maxMib} MiB. Compress it or share it as a link instead.`);
    setError(null);
    const fd = new FormData();
    fd.set("cohortId", cohortId);
    fd.set("week", String(week));
    fd.set("label", label.trim() || file.name);
    fd.set("file", file);
    if (replacesId) fd.set("replacesId", replacesId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      let body: { ok?: boolean; error?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.ok) {
        setDone(true);
        setLabel("");
        if (fileRef.current) fileRef.current.value = "";
        // Called from an XHR callback, outside React: refresh inside a transition
        // or the router may drop it and the list stays stale.
        startTransition(() => router.refresh());
        onDone?.();
      } else {
        setError(body?.error ?? (xhr.status === 413 ? `That file is too large (max ${maxMib} MiB).` : "The upload didn't finish. Any previous file is unchanged. Try again."));
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("The upload was interrupted. Any previous file is unchanged. Check your connection and try again.");
    };
    setProgress(0);
    xhr.send(fd);
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          {replacesId ? "New file" : "File"}
          <span className="block text-xs font-normal text-ink/60">PDF or PPTX, up to {maxMib} MiB.</span>
          <input ref={fileRef} type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled={busy} className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-forest" />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Label <span className="font-normal text-ink/50">(optional)</span>
          <span className="block text-xs font-normal text-ink/60">Defaults to the file name.</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={160} disabled={busy} className="mt-1.5 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20" />
        </label>
      </div>
      {busy && (
        <div role="status" aria-live="polite" className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-cream">
            <div className="h-full bg-emerald transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-ink/60">{progress! < 100 ? `Uploading… ${progress}%` : "Checking and saving the file…"}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      {done && !replacesId && (
        <p role="status" className="rounded-md border border-emerald/40 bg-emerald/5 px-3 py-2 text-sm text-success">
          File uploaded.
        </p>
      )}
      <button type="submit" disabled={busy} className={buttonClass("secondary", replacesId ? "sm" : "md")}>
        {busy ? "Uploading…" : replacesId ? "Upload replacement" : "Upload file"}
      </button>
    </form>
  );
}

export function ReplaceToggle({ cohortId, week, maxMib, resourceId, label }: { cohortId: string; week: number; maxMib: number; resourceId: string; label: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className={buttonClass("secondary", "sm")} onClick={() => setOpen(true)}>
        Replace
      </button>
    );
  return (
    <div className="w-full rounded-md border border-line/70 bg-cream/30 p-3">
      <p className="mb-2 text-xs text-ink/60">The current file stays available until the replacement finishes uploading.</p>
      <UploadForm cohortId={cohortId} week={week} maxMib={maxMib} replacesId={resourceId} replacesLabel={label} onDone={() => setOpen(false)} />
      <button type="button" className={cx(buttonClass("ghost", "sm"), "mt-2")} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
