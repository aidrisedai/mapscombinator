"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Field, inputClass, type Result } from "@/components/ui/forms";
import { buttonClass, cx } from "@/components/ui/primitives";
import { previewInvitationAction, sendInvitationAction, type InvitationPreview } from "../actions";

import { ROLE_LABEL } from "./roles";

const NETWORK = "We couldn't reach the server. Nothing was sent. Check your connection and try again.";

async function call(action: (fd: FormData) => Promise<Result>, fields: Record<string, string>): Promise<Result> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  try {
    return await action(fd);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    return { ok: false, error: NETWORK };
  }
}

/** Two-step invite: preview the exact message, then confirm to queue it. */
function useInvite() {
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  function runPreview(fields: Record<string, string>) {
    start(async () => {
      const r = await call(previewInvitationAction, fields);
      if (r.ok) {
        setPreview(r.data as InvitationPreview);
        setError(null);
        setFieldErrors({});
        setSentTo(null);
      } else {
        setPreview(null);
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
      }
    });
  }

  function confirm(fields: Record<string, string>, onSent?: () => void) {
    start(async () => {
      const r = await call(sendInvitationAction, fields);
      if (r.ok) {
        setSentTo(preview?.to ?? fields.email);
        setPreview(null);
        setError(null);
        onSent?.();
              } else {
        setError(r.error);
      }
    });
  }

  function cancel() {
    setPreview(null);
    setError(null);
  }

  return { pending, preview, error, fieldErrors, sentTo, runPreview, confirm, cancel };
}

function PreviewPanel({ preview, pending, error, onConfirm, onCancel }: { preview: InvitationPreview; pending: boolean; error: string | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="mt-4 rounded-lg border border-forest/25 bg-cream/40 p-4" role="region" aria-label="Invitation preview">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald">Review before sending</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="font-medium text-ink/60">Recipient</dt>
        <dd className="break-all font-semibold text-ink">{preview.to}</dd>
        <dt className="font-medium text-ink/60">Role</dt>
        <dd className="text-ink">{ROLE_LABEL[preview.role] ?? preview.role}</dd>
        {preview.cohort && (
          <>
            <dt className="font-medium text-ink/60">Cohort</dt>
            <dd className="text-ink">{preview.cohort}</dd>
          </>
        )}
        {preview.startup && (
          <>
            <dt className="font-medium text-ink/60">Startup</dt>
            <dd className="text-ink">{preview.startup}</dd>
          </>
        )}
        <dt className="font-medium text-ink/60">Subject</dt>
        <dd className="text-ink">{preview.subject}</dd>
      </dl>
      <div className="mt-3">
        <p className="text-sm font-medium text-ink/60">Message</p>
        <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-paper p-3 font-sans text-sm leading-relaxed text-ink">{preview.text}</pre>
        <p className="mt-1 text-xs text-ink/60">The personal sign-up link (shown as •••) is created only when you confirm. It works once and expires on the date shown.</p>
      </div>
      {preview.alreadyHasAccess && (
        <p role="status" className="mt-3 rounded-md border border-[#f0c987] bg-[#fff8ec] px-3 py-2 text-sm text-ink">
          <strong>{preview.to}</strong> already has this access, so there is nothing to send. If they can&apos;t sign in, they can reset their password from the sign-in page.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={buttonClass("primary")} disabled={pending || preview.alreadyHasAccess} onClick={onConfirm}>
          {pending ? "Queuing…" : "Confirm and send"}
        </button>
        <button type="button" className={buttonClass("secondary")} disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SentNotice({ to }: { to: string }) {
  return (
    <p role="status" className="mt-3 rounded-md border border-emerald/40 bg-emerald/5 px-3 py-2 text-sm text-success">
      Invitation queued for {to}. Its status below changes once the email provider accepts it; that is not proof it reached the inbox.
    </p>
  );
}

/** Per-contact "Invite" button that opens the preview directly (optionally on load). */
export function InviteContactButton({ cohortId, enrollmentId, name, email, autoOpen = false, canInvite = true }: { cohortId: string; enrollmentId: string; name: string; email: string; autoOpen?: boolean; canInvite?: boolean }) {
  const inv = useInvite();
  const fields = { role: "founder", cohortId, enrollmentId, name, email };
  const opened = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { runPreview } = inv;

  useEffect(() => {
    if (!autoOpen || !canInvite || opened.current) return;
    opened.current = true;
    runPreview({ role: "founder", cohortId, enrollmentId, name, email });
    panelRef.current?.scrollIntoView({ block: "center" });
  }, [autoOpen, canInvite, runPreview, cohortId, enrollmentId, name, email]);

  return (
    <div ref={panelRef} className="w-full">
      {!inv.preview && canInvite && (
        <button type="button" className={buttonClass("secondary", "sm")} disabled={inv.pending} onClick={() => inv.runPreview(fields)}>
          {inv.pending ? "Preparing preview…" : "Invite"}
        </button>
      )}
      {!inv.preview && inv.error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {inv.error}
        </p>
      )}
      {inv.preview && <PreviewPanel preview={inv.preview} pending={inv.pending} error={inv.error} onConfirm={() => inv.confirm(fields)} onCancel={inv.cancel} />}
      {inv.sentTo && <SentNotice to={inv.sentTo} />}
    </div>
  );
}

/** Name + email (+ role) form → preview → confirm. */
export function InviteForm({
  cohortId,
  enrollmentId,
  roles,
  fixedRole,
  addContact = false,
  emailHint,
}: {
  cohortId: string | null;
  enrollmentId?: string;
  roles?: { value: string; label: string }[];
  fixedRole?: string;
  addContact?: boolean;
  emailHint?: string;
}) {
  const inv = useInvite();
  const [role, setRole] = useState(fixedRole ?? roles?.[0]?.value ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const fields: Record<string, string> = { role, name, email, cohortId: cohortId ?? "", enrollmentId: enrollmentId ?? "", addContact: addContact ? "1" : "" };
  const fe = inv.fieldErrors;
  const locked = Boolean(inv.preview);

  return (
    <div>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!inv.pending) inv.runPreview(fields);
        }}
      >
        <div className={cx("grid gap-4", roles ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {roles && (
            <Field label="Role" name="role" required error={fe.role}>
              {({ id, describedBy, invalid }) => (
                <select id={id} name="role" value={role} disabled={locked} onChange={(e) => setRole(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} className={inputClass}>
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Name" name="name" required={addContact} optional={!addContact} error={fe.name}>
            {({ id, describedBy, invalid }) => (
              <input id={id} name="name" value={name} disabled={locked} maxLength={120} autoComplete="off" onChange={(e) => setName(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} className={inputClass} />
            )}
          </Field>
          <Field label="Email" name="email" required hint={emailHint} error={fe.email}>
            {({ id, describedBy, invalid }) => (
              <input id={id} name="email" type="email" value={email} disabled={locked} autoComplete="off" onChange={(e) => setEmail(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} className={inputClass} />
            )}
          </Field>
        </div>
        {!inv.preview && inv.error && (
          <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
            {inv.error}
          </p>
        )}
        {!inv.preview && (
          <button type="submit" className={buttonClass("secondary")} disabled={inv.pending}>
            {inv.pending ? "Preparing preview…" : "Preview invitation"}
          </button>
        )}
      </form>
      {inv.preview && (
        <PreviewPanel
          preview={inv.preview}
          pending={inv.pending}
          error={inv.error}
          onConfirm={() =>
            inv.confirm(fields, () => {
              setName("");
              setEmail("");
            })
          }
          onCancel={inv.cancel}
        />
      )}
      {inv.sentTo && <SentNotice to={inv.sentTo} />}
    </div>
  );
}
