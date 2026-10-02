import type { Metadata } from "next";
import Link from "next/link";
import { MODE_LABEL, SessionBadges, isUpdated } from "@/components/office-hours/badges";
import { When } from "@/components/office-hours/When";
import { Card, EmptyState, PageHeader, SectionTitle, Tabs, cx } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { listSessions } from "@/lib/server/domain/office-hours";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { todayIn } from "@/lib/time";
import { CreateSessionForm } from "./CreateSessionForm";
import { sessionFormOptions } from "./data";

export const metadata: Metadata = { title: "Manage office hours" };

export default async function ManageOfficeHoursPage({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId } = await params;
  const past = one((await searchParams).when) === "past";
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/office-hours`);
  const access = await load(() => requireCohortAdmin(account, cohortId));
  const [{ sessions }, { hosts, weeks, weekNumberById }] = await Promise.all([
    load(() => listSessions(account, cohortId, { when: past ? "past" : "upcoming", limit: 200 })),
    load(() => sessionFormOptions(account, cohortId)),
  ]);
  const base = `/manage/cohorts/${cohortId}/office-hours`;
  const tz = access.cohort.timezone;
  const writable = access.cohort.status !== "archived";
  return (
    <>
      <PageHeader
        title="Office hours"
        description="Group sessions for the whole cohort. New sessions start as drafts; publish them when the details are final."
      />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section>
          <Tabs
            current={past ? "past" : "upcoming"}
            items={[
              { key: "upcoming", href: base, label: "Upcoming (incl. drafts)" },
              { key: "past", href: `${base}?when=past`, label: "Past" },
            ]}
          />
          {sessions.length === 0 ? (
            <EmptyState title={past ? "No past sessions" : "No upcoming sessions"}>
              {past ? "Sessions move here after they end." : "Add the first session with the form. You can preview a weekly series before creating it."}
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {sessions.map((s) => {
                const wk = s.week_id ? weekNumberById.get(s.week_id) : undefined;
                return (
                  <Card as="li" key={s.id} className={cx("space-y-1.5", s.state === "draft" && "border-dashed bg-cream/30", s.state === "cancelled" && "bg-cream/40")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`${base}/${s.id}`} className={cx("font-semibold text-forest hover:text-emerald", s.state === "cancelled" && "line-through decoration-error/60")}>{s.title}</Link>
                      <SessionBadges state={s.state} updated={isUpdated(s)} admin past={past} />
                      {s.series_id && <span className="text-xs text-ink/60">Series {s.series_position}/{s.series_count}</span>}
                    </div>
                    <When start={s.starts_at} end={s.ends_at} tz={s.timezone} className="text-sm" strike={s.state === "cancelled"} />
                    <p className="text-sm text-ink/70">
                      {[s.host_name && `Host: ${s.host_name}`, MODE_LABEL[s.mode], wk && `Week ${wk}`, s.last_notified_at && "Emailed"].filter(Boolean).join(" · ")}
                    </p>
                  </Card>
                );
              })}
            </ul>
          )}
        </section>
        <section>
          <SectionTitle>Add session</SectionTitle>
          {writable ? (
            <Card>
              <CreateSessionForm cohortId={cohortId} hosts={hosts} weeks={weeks} timezone={tz} defaultDate={todayIn(tz)} />
            </Card>
          ) : (
            <p className="text-sm text-ink/70">This cohort is archived, so sessions can&apos;t be added.</p>
          )}
        </section>
      </div>
    </>
  );
}
