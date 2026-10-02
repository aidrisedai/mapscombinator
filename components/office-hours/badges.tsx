import { Badge } from "@/components/ui/primitives";

export const MODE_LABEL: Record<string, string> = { online: "Online", in_person: "In person", hybrid: "Hybrid" };

/** A published session changed after it was first published. */
export function isUpdated(s: { [column: string]: unknown }) {
  const pub = s.published_at as Date | string | null | undefined;
  const upd = s.updated_at as Date | string | null | undefined;
  return s.state === "published" && Boolean(pub && upd) && new Date(upd!).getTime() - new Date(pub!).getTime() > 1000;
}

/** Session state labels. `admin` also shows Draft/Published explicitly. */
export function SessionBadges({ state, updated = false, admin = false, past = false }: { state: string; updated?: boolean; admin?: boolean; past?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {state === "draft" && <Badge tone="draft">Draft — not visible to founders</Badge>}
      {state === "published" && admin && <Badge tone="published">Published</Badge>}
      {state === "cancelled" && <Badge tone="danger">Cancelled</Badge>}
      {state === "published" && updated && <Badge tone="info">Updated</Badge>}
      {past && state !== "cancelled" && <Badge>Past</Badge>}
    </span>
  );
}

const BOOKING: Record<string, { label: string; tone: "published" | "danger" | "info" | "warn" }> = {
  confirmed: { label: "Confirmed", tone: "published" },
  cancelled: { label: "Cancelled", tone: "danger" },
  completed: { label: "Completed", tone: "info" },
  no_show: { label: "No-show", tone: "warn" },
};

/** Booking status — only ever rendered for the startup, its mentor and admins. */
export function BookingBadge({ state }: { state: string }) {
  const b = BOOKING[state] ?? { label: state, tone: "info" as const };
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

const ANNOUNCEMENT: Record<string, { label: string; tone: "published" | "draft" }> = {
  published: { label: "Published", tone: "published" },
  draft: { label: "Draft", tone: "draft" },
};
export function AnnouncementBadge({ state }: { state: string }) {
  const b = ANNOUNCEMENT[state] ?? { label: state, tone: "draft" as const };
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

const EMAIL_STATE: Record<string, string> = {
  queued: "queued",
  sending: "sending",
  provider_accepted: "accepted by email provider",
  delivered: "delivered",
  bounced: "bounced",
  complained: "marked as spam",
  failed: "failed",
  suppressed: "suppressed",
};

/** "42 queued · 3 accepted by email provider" — never claims "sent". */
export function EmailCounts({ rows }: { rows: { state: string; n: number }[] }) {
  if (!rows.length) return <span className="text-ink/60">No emails have been queued.</span>;
  return <span>{rows.map((r) => `${r.n} ${EMAIL_STATE[r.state] ?? r.state}`).join(" · ")}</span>;
}
