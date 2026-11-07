"use client";

import { useState, useTransition } from "react";
import { buttonClass, cx } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/forms";
import { copyInvitationLinkAction } from "../actions";

/** Get a link to send yourself (WhatsApp, text, your own email). Works alongside the emailed one. */
export function CopyInviteLink({ invitationId, email, name, context }: { invitationId: string; email: string; name?: string | null; context?: string | null }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const get = () =>
    start(async () => {
      setCopied(false);
      try {
        const f = new FormData();
        f.set("invitationId", invitationId);
        const r = await copyInvitationLinkAction(f);
        if (!r.ok) return setError(r.error);
        setError(null);
        const url = (r.data as { link: string }).link;
        setLink(url);
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        } catch {
          /* clipboard may be blocked; the link is shown to copy by hand */
        }
      } catch {
        setError("Couldn't reach the server. Try again.");
      }
    });

  const first = (name ?? "").trim().split(/\s+/)[0];
  const message = `Hi${first ? ` ${first}` : ""}, here's your invitation to ${context ?? "our program on the MAPS Combinator platform"}. Open this link to set your password and get started: ${link ?? ""}`;

  return (
    <div className="w-full space-y-2">
      {!link ? (
        <button type="button" onClick={get} disabled={pending} className={buttonClass("secondary", "sm")}>
          {pending ? "Getting link…" : "Copy invite link"}
        </button>
      ) : (
        <div className="space-y-2 rounded-md border border-forest/30 bg-forest/5 p-3">
          <label className="block text-xs font-semibold text-ink" htmlFor={`link-${invitationId}`}>
            Invite link for {email}
          </label>
          <input id={`link-${invitationId}`} readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={cx(inputClass, "font-mono text-xs")} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass("primary", "sm")}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                } catch {
                  setError("Your browser blocked copying. Select the link above and copy it.");
                }
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <a className={buttonClass("secondary", "sm")} href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <a className={buttonClass("secondary", "sm")} href={`mailto:${email}?subject=${encodeURIComponent("Your MAPS Combinator invitation")}&body=${encodeURIComponent(message)}`}>
              Email it yourself
            </a>
            <button type="button" onClick={get} disabled={pending} className={buttonClass("ghost", "sm")}>
              {pending ? "…" : "New link"}
            </button>
          </div>
          <p className="text-xs text-ink/60">
            Send it only to {email}. They open it, set their own password and land in the platform. Getting a new link stops the previous copied link; the emailed link keeps working.
          </p>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
    </div>
  );
}
