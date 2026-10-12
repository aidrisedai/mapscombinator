"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { ActionForm, TextField, inputClass } from "@/components/ui/forms";
import { KeyValue, LinkButton, Notice, buttonClass } from "@/components/ui/primitives";
import {
  acceptExistingAction,
  acceptNewAction,
  inspectInvitationAction,
  requestInviteAction,
  sendInvitationCodeAction,
  switchAccountAction,
  verifyInvitationCodeAction,
  type InvitationInspection,
} from "../actions";

const PENDING = "maps:pending-invitation";

function readToken() {
  const h = window.location.hash.replace(/^#/, "");
  const fromHash = new URLSearchParams(h).get("token") ?? (h.includes("=") ? "" : h);
  try {
    if (fromHash) {
      // Survives a detour through sign-in in this tab; cleared on use.
      sessionStorage.setItem(PENDING, fromHash);
      return fromHash;
    }
    return sessionStorage.getItem(PENDING) ?? "";
  } catch {
    return fromHash;
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING);
  } catch {
    /* ignore */
  }
}

export function AcceptInvitation() {
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<InvitationInspection | null>(null);
  const [failed, setFailed] = useState(false);

  const inspect = useCallback(async (t: string) => {
    try {
      setInfo(await inspectInvitationAction(fd(t)));
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const t = readToken();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the token only exists in the browser (URL fragment)
    setToken(t);
    if (t) void inspect(t);
    else setInfo({ status: "invalid" });
  }, [inspect]);

  if (failed)
    return (
      <>
        <h1 className="font-display text-2xl font-bold text-forest">We couldn&apos;t load this invitation</h1>
        <p className="mt-2 text-sm text-ink/70">Check your connection and reload the page.</p>
      </>
    );
  if (!info || token === null) return <p role="status" className="text-sm text-ink/60">Checking your invitation…</p>;

  if (info.status === "invalid")
    return (
      <>
        <h1 className="font-display text-2xl font-bold text-forest">This link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-ink/70">It may be incomplete or replaced by a newer invitation. Open the most recent invitation email and use its button, or ask your program administrator to send a new one.</p>
        <p className="mt-6 text-sm"><Link className="font-medium text-emerald" href="/sign-in">Go to sign in</Link></p>
      </>
    );

  const details = (
    <div className="mt-5 rounded-md bg-cream/60 p-4">
      <KeyValue items={info.details} />
    </div>
  );

  if (info.status === "accepted") {
    clearPending();
    return (
      <>
        <h1 className="font-display text-2xl font-bold text-forest">Invitation already accepted</h1>
        <p className="mt-2 text-sm text-ink/70">This invitation has been used. Sign in with {info.email} to continue.</p>
        <div className="mt-6"><LinkButton href="/sign-in">Sign in</LinkButton></div>
      </>
    );
  }

  if (info.status === "expired" || info.status === "revoked")
    return (
      <>
        <h1 className="font-display text-2xl font-bold text-forest">{info.status === "expired" ? "This invitation has expired" : "This invitation was withdrawn"}</h1>
        <p className="mt-2 text-sm text-ink/70">
          {info.status === "expired" ? "Invitations are valid for a limited time. You can ask the administrator for a fresh one." : "The administrator withdrew this invitation. If you think that's a mistake, contact them."}
        </p>
        {details}
        <div className="mt-6">
          <ActionForm action={() => requestInviteAction(fd(token))} submitLabel="Ask for a new invitation" after="none" successMessage="Thanks — we let the program administrator know. They'll send a new invitation if appropriate.">
            <span />
          </ActionForm>
        </div>
        {info.support && <p className="mt-4 text-xs text-ink/60">Program contact: {info.support}</p>}
      </>
    );

  const header = (
    <>
      <h1 className="font-display text-2xl font-bold text-forest">You&apos;re invited</h1>
      <p className="mt-2 text-sm text-ink/70">This invitation is for <strong>{info.email}</strong>.</p>
      {details}
    </>
  );

  if (info.viewer === "mismatch")
    return (
      <>
        {header}
        <div className="mt-6 space-y-4">
          <Notice tone="warn" title="You're signed in with a different account">
            You&apos;re signed in as {info.viewerEmail}. This invitation can only be accepted by {info.email}.
          </Notice>
          <button
            className={buttonClass("primary")}
            onClick={async () => {
              await switchAccountAction();
              await inspect(token);
            }}
          >
            Sign out and switch account
          </button>
        </div>
      </>
    );

  if (info.viewer === "match")
    return (
      <>
        {header}
        <p className="mt-6 text-sm text-ink/70">You already have an account. Accepting adds this access to it; your password doesn&apos;t change.</p>
        <div className="mt-4">
          <ActionForm action={() => acceptExistingAction(fd(token))} submitLabel="Accept invitation" pendingLabel="Accepting…" after="none">
            <span />
          </ActionForm>
        </div>
      </>
    );

  if (info.accountExists)
    return (
      <>
        {header}
        <p className="mt-6 text-sm text-ink/70">There&apos;s already an account for {info.email}. Sign in to accept this invitation — you&apos;ll come straight back here.</p>
        <div className="mt-4"><LinkButton href="/sign-in?next=/accept-invitation">Sign in to accept</LinkButton></div>
      </>
    );

  if (info.needsCode && !info.emailVerified)
    return (
      <>
        {header}
        <EmailCodeStep token={token} email={info.email} onVerified={() => inspect(token)} />
      </>
    );

  return (
    <>
      {header}
      {info.needsCode && (
        <p className="mt-6 flex items-center gap-2 text-sm font-medium text-success" role="status">
          <span aria-hidden="true">✓</span> Email confirmed
        </p>
      )}
      <h2 className="mt-4 text-base font-semibold">{info.needsCode ? "Step 2 of 2: " : ""}Set up your account</h2>
      <p className="mt-1 text-sm text-ink/70">You&apos;ll sign in with {info.email} and this password.</p>
      <div className="mt-4">
        <ActionForm
          action={(form) => {
            form.set("token", token);
            return acceptNewAction(form);
          }}
          submitLabel="Create account and continue"
          pendingLabel="Setting up…"
          after="none"
        >
          <TextField label="Your name" name="displayName" autoComplete="name" hint="Shown to your cohort on posts you write." required />
          <TextField label="Password" name="password" type="password" autoComplete="new-password" minLength={10} hint="At least 10 characters." required />
          <TextField label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
        </ActionForm>
      </div>
    </>
  );
}

/** Step 1: prove control of the invited inbox with a 6-digit emailed code. */
function EmailCodeStep({ token, email, onVerified }: { token: string; email: string; onVerified: () => Promise<void> }) {
  const [sent, setSent] = useState<{ minutes: number } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = () =>
    start(async () => {
      try {
        const r = await sendInvitationCodeAction(fd(token));
        if (!r.ok) return setError(r.error);
        setError(null);
        setSent({ minutes: r.data.minutes });
        setNote(sent ? "A new code is on its way. Only the newest code works." : null);
        setCode("");
        setCooldown(30);
      } catch {
        setError("We couldn't reach the server. Check your connection and try again.");
      }
    });

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      try {
        const f = fd(token);
        f.set("code", code);
        const r = await verifyInvitationCodeAction(f);
        if (!r.ok) return setError(r.error);
        setError(null);
        await onVerified();
      } catch {
        setError("We couldn't reach the server. Check your connection and try again.");
      }
    });
  };

  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold">Step 1 of 2: Confirm your email</h2>
      {!sent ? (
        <>
          <p className="mt-1 text-sm text-ink/70">
            To make sure this invitation reached the right person, we&apos;ll email a 6-digit code to <strong>{email}</strong>. Then you&apos;ll choose your password.
          </p>
          {error && <p role="alert" className="mt-3 rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{error}</p>}
          <button type="button" className={`${buttonClass("primary")} mt-4`} disabled={pending} onClick={send}>
            {pending ? "Sending…" : "Email me a code"}
          </button>
        </>
      ) : (
        <form onSubmit={verify} className="mt-2 space-y-3" noValidate>
          <p className="text-sm text-ink/70">
            We sent a code to <strong>{email}</strong>. It expires in {sent.minutes} minutes. Check your spam folder if you don&apos;t see it.
          </p>
          {note && <p role="status" className="text-sm text-success">{note}</p>}
          <div>
            <label htmlFor="invite-code" className="block text-sm font-semibold text-ink">6-digit code</label>
            <input
              id="invite-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, ""))}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "invite-code-err" : undefined}
              className={`${inputClass} mt-1.5 max-w-[12rem] text-center font-mono text-xl tracking-[0.4em]`}
              autoFocus
            />
          </div>
          {error && <p id="invite-code-err" role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={buttonClass("primary")} disabled={pending || code.replace(/\D/g, "").length !== 6}>
              {pending ? "Checking…" : "Confirm email"}
            </button>
            <button type="button" className={buttonClass("ghost")} disabled={pending || cooldown > 0} onClick={send}>
              {cooldown > 0 ? `Send a new code (${cooldown}s)` : "Send a new code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function fd(token: string) {
  const f = new FormData();
  f.set("token", token);
  return f;
}
