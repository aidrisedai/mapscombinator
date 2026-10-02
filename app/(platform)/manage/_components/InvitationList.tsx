import { ActionButton } from "@/components/ui/forms";
import { Badge, type BadgeTone } from "@/components/ui/primitives";
import { invitationStatusLabel } from "@/lib/server/domain/invitations";
import { formatInstant } from "@/lib/time";
import { resendInvitationAction, revokeInvitationAction } from "../actions";
import { ROLE_LABEL } from "./roles";

type Row = Record<string, unknown>;

function tone(label: string): BadgeTone {
  if (label === "Accepted" || label === "Delivered") return "published";
  if (label === "Bounced" || label === "Delivery failed" || label === "Marked as spam") return "danger";
  if (label === "Queued") return "draft";
  if (label === "Expired" || label === "Revoked") return "neutral";
  if (label.startsWith("Not sent")) return "warn";
  return "info";
}

/** Invitation rows with honest delivery labels, Resend (rotates the link) and Revoke. */
export function InvitationList({ rows, timezone, showRole = false, canManage = () => true, empty }: { rows: Row[]; timezone: string; showRole?: boolean; canManage?: (r: Row) => boolean; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-ink/60">{empty}</p>;
  return (
    <ul className="divide-y divide-line/60">
      {rows.map((i) => {
        const label = invitationStatusLabel(i as { state: string; delivery_state: string; expires_at: Date });
        const open = i.state !== "accepted" && i.state !== "revoked";
        const help = i.help_requests as number;
        return (
          <li key={i.id as string} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="break-all font-medium text-ink">{(i.invitee_name as string) || (i.email as string)}</span>
                {i.invitee_name ? <span className="break-all text-ink/60">{i.email as string}</span> : null}
                <Badge tone={tone(label)}>{label}</Badge>
                {showRole && <Badge tone="neutral">{ROLE_LABEL[i.role as string] ?? (i.role as string)}</Badge>}
                {help > 0 && <Badge tone="warn">Asked for a new link</Badge>}
              </p>
              <p className="text-xs text-ink/60">
                Invited {formatInstant(i.created_at as Date, timezone)}
                {i.last_sent_at ? ` · Last accepted by email provider ${formatInstant(i.last_sent_at as Date, timezone)}` : ""}
                {i.accepted_at ? ` · Accepted ${formatInstant(i.accepted_at as Date, timezone)}` : open ? ` · Link expires ${formatInstant(i.expires_at as Date, timezone)}` : ""}
                {` · Sent ${i.send_count as number} ${(i.send_count as number) === 1 ? "time" : "times"}`}
              </p>
              {open && i.last_error ? <p className="text-xs text-error">Last delivery note: {i.last_error as string}</p> : null}
            </div>
            {open && canManage(i) && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <ActionButton
                  action={resendInvitationAction}
                  fields={{ invitationId: i.id as string }}
                  label="Resend"
                  pendingLabel="Queuing…"
                  confirmMessage={`Send a fresh invitation to ${i.email as string}? The previous link stops working immediately.`}
                />
                <ActionButton
                  action={revokeInvitationAction}
                  fields={{ invitationId: i.id as string }}
                  label="Revoke"
                  pendingLabel="Revoking…"
                  variant="danger"
                  confirmMessage={`Revoke the invitation for ${i.email as string}? The link stops working immediately.`}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
