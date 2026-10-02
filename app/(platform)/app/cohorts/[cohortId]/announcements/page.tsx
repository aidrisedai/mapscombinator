import type { Metadata } from "next";
import { requestNow } from "@/components/office-hours/now";
import Link from "next/link";
import { Badge, EmptyState, ExternalLink, PageHeader, Prose, cx } from "@/components/ui/primitives";
import { listAnnouncements } from "@/lib/server/domain/announcements";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const includeExpired = one(sp.expired) === "1";
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/announcements`);
  const { access, announcements } = await load(() => listAnnouncements(account, cohortId, { includeExpired, limit: 100 }));
  const tz = access.cohort.timezone;
  const base = `/app/cohorts/${cohortId}/announcements`;
  const now = requestNow();
  return (
    <>
      <PageHeader
        title="Announcements"
        description="Messages from the program team. Pinned announcements stay at the top."
        actions={
          access.isAdmin ? (
            <Link href={`/manage/cohorts/${cohortId}/announcements`} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-forest hover:border-forest">
              Manage announcements
            </Link>
          ) : undefined
        }
      />
      <nav aria-label="Filter" className="mb-5 flex gap-2 text-sm">
        {[
          { href: base, label: "Current", on: !includeExpired },
          { href: `${base}?expired=1`, label: "Include expired", on: includeExpired },
        ].map((f) => (
          <Link
            key={f.label}
            href={f.href}
            aria-current={f.on ? "page" : undefined}
            className={cx("rounded-full border px-3 py-1 font-medium", f.on ? "border-forest bg-forest text-paper" : "border-line text-ink/70 hover:border-forest hover:text-forest")}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {announcements.length === 0 ? (
        <EmptyState title={includeExpired ? "No announcements yet" : "No current announcements"}>
          {access.isAdmin
            ? "Write one from Manage → Announcements. Founders see it here once it's published."
            : includeExpired
              ? "When the program team posts an announcement, it appears here."
              : "Nothing is active right now. Older announcements are under “Include expired”."}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {announcements.map((n) => {
            const expired = n.expires_at && new Date(n.expires_at).getTime() <= now;
            return (
              <li key={n.id} id={`a-${n.id}`} className={cx("rounded-lg border border-line/80 border-l-4 bg-paper p-5", expired ? "border-l-line opacity-80" : "border-l-forest", n.pinned && !expired && "bg-cream/40")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald">Program announcement</span>
                  {n.pinned && <Badge tone="info">Pinned</Badge>}
                  {expired && <Badge>Expired</Badge>}
                </div>
                <h2 className="mt-1 font-display text-xl font-bold text-forest">{n.title}</h2>
                <p className="mt-1 text-xs text-ink/60">
                  {n.author} · {formatInstant(n.publish_at ?? n.created_at, tz)}
                  {n.expires_at && !expired && ` · Until ${formatInstant(new Date(new Date(n.expires_at).getTime() - 60_000), tz)}`}
                </p>
                <Prose text={n.body} className="mt-3" />
                {(n.link || n.week_number || n.session_id) && (
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {n.link && <ExternalLink href={n.link}>Open link</ExternalLink>}
                    {n.week_number ? (
                      <Link className="font-medium text-emerald hover:text-forest" href={`/app/cohorts/${cohortId}/weeks/${n.week_number}`}>Week {n.week_number} guide</Link>
                    ) : null}
                    {n.session_id && (
                      <Link className="font-medium text-emerald hover:text-forest" href={`/app/cohorts/${cohortId}/office-hours/${n.session_id}`}>Related session</Link>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
