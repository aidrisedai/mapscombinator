"use client";

import { useEffect, useState } from "react";
import { ActionForm } from "@/components/ui/forms";
import { confirmTokenAction } from "../../actions";

export function ConfirmForm() {
  const [p, setP] = useState<{ type: string; tokenHash: string } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- token lives only in the URL fragment
    setP({ type: q.get("type") ?? "", tokenHash: q.get("token_hash") ?? "" });
  }, []);
  if (!p) return <p role="status" className="text-sm text-ink/60">Loading…</p>;
  const emailChange = p.type === "email_change";
  if (!p.tokenHash)
    return (
      <>
        <h1 className="font-display text-2xl font-bold text-forest">This link is incomplete</h1>
        <p className="mt-2 text-sm text-ink/70">Open the button in your most recent email, or request a new link.</p>
      </>
    );
  return (
    <>
      <h1 className="font-display text-2xl font-bold text-forest">{emailChange ? "Confirm your new email" : "Reset your password"}</h1>
      <p className="mt-2 text-sm text-ink/70">For your security this link works once. Continue only if you requested it.</p>
      <div className="mt-6">
        <ActionForm
          action={(fd) => {
            fd.set("type", p.type);
            fd.set("token_hash", p.tokenHash);
            return confirmTokenAction(fd);
          }}
          submitLabel={emailChange ? "Confirm my new email" : "Continue to choose a new password"}
          pendingLabel="Checking…"
          after="none"
        >
          <span />
        </ActionForm>
      </div>
    </>
  );
}
