import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCohortRead } from "@/lib/server/authz";
import { sql } from "@/lib/server/db";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatDate, formatInstant } from "@/lib/time";
import { teamProgress } from "@/lib/server/domain/advisors";

export const metadata: Metadata = { title: "Startups" };

export default async function StartupsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/startups`);
  const a = await load(() => requireCohortRead(account, cohortId));
  const rows = await sql()`
    select e.id, s.name, s.description, s.website,
      (select max(u.last_published_at) from team_updates u where u.enrollment_id = e.id and u.state = 'published' and u.hidden_at is null) as last_published
    from enrollments e join startups s on s.id = e.startup_id
    where e.cohort_id = ${cohortId} and e.status = 'active' order by s.name`;
  const progress = await teamProgress(account, cohortId);
  return (
    <>
      <PageHeader title="Startups" description={`${rows.length} startup${rows.length === 1 ? "" : "s"} in ${a.cohort.name}.`} />
      {progress && rows.length > 0 && (
        <p className="-mt-4 mb-6 text-sm text-ink/70">
          Progress for <strong>Week {progress.week}</strong> ({formatDate(progress.weekStart)} – {formatDate(progress.weekEnd)}), counting published updates only. Open a startup to read its updates.
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState title="No startups yet">Startups appear here once the program team enrolls them.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => (
            <Card as="li" key={s.id}>
              <Link href={`/app/cohorts/${cohortId}/startups/${s.id}`} className="font-display text-lg font-bold text-forest hover:text-emerald">
                {s.name}
              </Link>
              <p className="mt-1 line-clamp-3 text-sm text-ink/70">{s.description}</p>
              {progress && <ProgressLine p={progress.byTeam.get(s.id as string)} />}
              <p className="mt-3 text-xs text-ink/50">{s.last_published ? `Last update ${formatInstant(s.last_published, a.cohort.timezone)}` : "No published updates yet"}</p>
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}

function ProgressLine({ p }: { p?: { dailies: number; weekly: boolean; total: number } }) {
  if (!p) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5 text-xs" aria-label="This week's progress">
      <li className="rounded-full bg-cream px-2 py-0.5 font-medium text-ink/80">
        {p.dailies} daily update{p.dailies === 1 ? "" : "s"} this week
      </li>
      <li className={p.weekly ? "rounded-full bg-emerald/10 px-2 py-0.5 font-medium text-success" : "rounded-full bg-cream px-2 py-0.5 font-medium text-ink/60"}>
        {p.weekly ? "Weekly summary posted" : "No weekly summary yet"}
      </li>
      <li className="rounded-full bg-cream px-2 py-0.5 font-medium text-ink/60">{p.total} total</li>
    </ul>
  );
}
