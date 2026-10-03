import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, ExternalLink, Notice, SectionTitle, buttonClass } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { cohortSetupCounts } from "@/lib/server/domain/cohorts";
import { listInvitations } from "@/lib/server/domain/invitations";
import { participation } from "@/lib/server/domain/updates";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatDate, formatInstant, programWeeks, todayIn, weekNumberFor } from "@/lib/time";
import { LifecycleActions } from "../../_components/LifecycleActions";
import { ROLE_LABEL } from "../../_components/roles";

export const metadata: Metadata = { title: "Cohort overview" };

export default async function CohortOverviewPage({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  const base = `/manage/cohorts/${cohort.id}`;

  const today = todayIn(cohort.timezone);
  const currentWeek = weekNumberFor(cohort.startDate, cohort.weekCount, today);
  const beforeStart = today < cohort.startDate;
  const defaultWeek = currentWeek ?? (beforeStart ? 1 : cohort.weekCount);
  const requested = Number(one(sp.week));
  const week = Number.isInteger(requested) && requested >= 1 && requested <= cohort.weekCount ? requested : defaultWeek;
  const weeks = programWeeks(cohort.startDate, cohort.weekCount);
  const selected = weeks[week - 1];

  const [counts, rows, invitations] = await Promise.all([
    cohortSetupCounts(account, cohort.id),
    participation(account, cohort.id, today, week),
    listInvitations(cohort.id),
  ]);
  const helpRequests = invitations.filter((i) => (i.help_requests as number) > 0);
  const needsSetup = counts.admins === 0 || counts.startups === 0 || counts.publishedWeeks === 0;

  return (
    <div className="space-y-8">
      <h1 className="sr-only">{cohort.name} overview</h1>
      {one(sp.created) === "1" && (
        <Notice tone="success" title="Cohort created as a draft">
          Next, assign at least one cohort administrator on the <Link className="font-medium text-emerald underline" href={`${base}/members`}>Members</Link> tab. Nobody has been emailed.
        </Notice>
      )}

      {needsSetup && (
        <Card>
          <SectionTitle>Getting this cohort ready</SectionTitle>
          <ol className="space-y-3 text-sm">
            <SetupStep done={counts.admins > 0} href={`${base}/members`} label="Assign a cohort administrator">
              Administrators run the cohort day to day. {account.isOwner ? "Invite one from the Members tab (you can also invite yourself by email)." : ""}
            </SetupStep>
            <SetupStep done={counts.startups > 0} href={`${base}/startups`} label="Add startups">
              Create each startup with its primary contact, then invite its founders.
            </SetupStep>
            <SetupStep done={counts.publishedWeeks > 0} href={`${base}/weeks`} label="Publish the first week of the weekly guide">
              Founders only see weeks you publish. Drafts stay private.
            </SetupStep>
            {cohort.status === "draft" && (
              <SetupStep done={false} label="Activate the cohort">
                When everything is in place, activate it below so founders can start posting.
              </SetupStep>
            )}
          </ol>
        </Card>
      )}

      <section aria-labelledby="participation">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="participation" className="text-base font-semibold text-ink">
              Participation
            </h2>
            <p className="mt-1 text-sm text-ink/70">
              Today is {formatDate(today)} in {cohort.timezone.replaceAll("_", " ")}.{" "}
              {currentWeek ? `This is Week ${currentWeek}.` : beforeStart ? "The program hasn't started yet." : "The program dates have ended."} Showing Week {week} ({formatDate(selected.startDate)} – {formatDate(selected.endDate)}).
            </p>
          </div>
          <form method="get" className="flex items-end gap-2">
            <label className="text-sm font-semibold text-ink">
              <span className="block">Week</span>
              <select name="week" defaultValue={String(week)} className="mt-1 rounded-md border border-line bg-paper px-3 py-2 text-sm">
                {weeks.map((w) => (
                  <option key={w.number} value={w.number}>
                    Week {w.number} · {formatDate(w.startDate)}
                  </option>
                ))}
              </select>
            </label>
            <button className={buttonClass("secondary")}>Show</button>
          </form>
        </div>
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-line bg-cream/40 px-4 py-6 text-center text-sm text-ink/70">
            No startups are enrolled yet. <Link href={`${base}/startups`} className="font-medium text-emerald underline">Add a startup</Link> to see who has posted.
          </p>
        ) : (
          <div className="relative overflow-x-auto rounded-lg border border-line/80">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-cream/60 text-xs uppercase tracking-wide text-ink/60">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Startup</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Today ({formatDate(today)})</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Daily updates, Week {week}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Weekly summary</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Last published</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {rows.map((r) => (
                  <tr key={r.enrollment_id as string}>
                    <td className="px-3 py-2.5 font-medium">
                      <Link href={`${base}/startups/${r.enrollment_id}`} className="text-forest hover:text-emerald">
                        {r.name as string}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.daily_today ? <Badge tone="published">Published</Badge> : r.daily_draft ? <Badge tone="draft">Draft only</Badge> : <span className="text-ink/60">No update yet</span>}
                    </td>
                    <td className="px-3 py-2.5 text-ink/80">{r.dailies_this_week as number}</td>
                    <td className="px-3 py-2.5">{r.weekly_done ? <Badge tone="published">Published</Badge> : <span className="text-ink/60">Not yet</span>}</td>
                    <td className="px-3 py-2.5 text-ink/70">{r.last_published ? formatInstant(r.last_published as Date, cohort.timezone) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-ink/60">Posting status only, to help you offer support. &ldquo;No update yet&rdquo; isn&apos;t a judgment; teams work at different rhythms.</p>
      </section>

      {helpRequests.length > 0 && (
        <Card>
          <SectionTitle>Invitation help requests</SectionTitle>
          <p className="mb-3 text-sm text-ink/70">These people opened an expired or revoked invitation and asked for a new one. Resending also marks the request handled.</p>
          <ul className="divide-y divide-line/60 text-sm">
            {helpRequests.map((i) => (
              <li key={i.id as string} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{(i.invitee_name as string) || (i.email as string)}</span>
                  <span className="text-ink/60"> · {i.email as string} · {ROLE_LABEL[i.role as string] ?? (i.role as string)}</span>
                </span>
                <Link href={i.enrollment_id ? `${base}/startups/${i.enrollment_id}` : `${base}/members`} className="font-medium text-emerald hover:text-forest">
                  Review invitation →
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <SectionTitle>Cohort status</SectionTitle>
          <LifecycleActions cohortId={cohort.id} status={cohort.status} isOwner={account.isOwner} hasAdmins={counts.admins > 0} />
        </Card>
        <Card>
          <SectionTitle>Export</SectionTitle>
          <p className="text-sm text-ink/70">Download this cohort&apos;s records. Exports include private drafts and contact details; store them securely.</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href={`/api/export/${cohort.id}?format=json`} className="font-medium text-emerald underline underline-offset-2 hover:text-forest">
                Full cohort export (JSON)
              </a>
              <span className="text-ink/60"> · everything, for backup or migration</span>
            </li>
            <li>
              <a href={`/api/export/${cohort.id}?format=csv`} className="font-medium text-emerald underline underline-offset-2 hover:text-forest">
                Team updates (CSV)
              </a>
              <span className="text-ink/60"> · opens in a spreadsheet</span>
            </li>
          </ul>
          {cohort.supportEmail && (
            <p className="mt-4 text-xs text-ink/60">
              Cohort replies go to <ExternalLink href={`mailto:${cohort.supportEmail}`}>{cohort.supportEmail}</ExternalLink>.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function SetupStep({ done, href, label, children }: { done: boolean; href?: string; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className={done ? "mt-0.5 text-success" : "mt-0.5 text-ink/30"}>
        {done ? "✓" : "○"}
      </span>
      <div>
        <p className={done ? "font-medium text-ink/60 line-through" : "font-medium text-ink"}>
          {href && !done ? (
            <Link href={href} className="text-forest hover:text-emerald">
              {label}
            </Link>
          ) : (
            label
          )}
          <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
        </p>
        {!done && <p className="text-ink/70">{children}</p>}
      </div>
    </li>
  );
}
