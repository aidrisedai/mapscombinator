import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/ui/forms";
import { Badge, Card, EmptyState, PageHeader, Pagination, cx, type BadgeTone } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { listCohortOutbox, OUTBOX_STATES } from "@/lib/server/domain/invitations";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";
import { retryEmailAction } from "../../../actions";

export const metadata: Metadata = { title: "Email delivery" };

const STATE: Record<string, { label: string; tone: BadgeTone; meaning: string }> = {
  queued: { label: "Queued", tone: "draft", meaning: "Waiting to be handed to the email provider. Temporary errors are retried automatically." },
  sending: { label: "Sending", tone: "draft", meaning: "Being handed to the email provider right now." },
  provider_accepted: { label: "Accepted by provider (not proof of inbox delivery)", tone: "info", meaning: "The provider took the message. It may still bounce or land in spam." },
  delivered: { label: "Delivered", tone: "published", meaning: "The provider confirmed the recipient's mail server received it." },
  bounced: { label: "Bounced", tone: "danger", meaning: "The recipient's server rejected it. Check the address before inviting again." },
  complained: { label: "Complained", tone: "danger", meaning: "The recipient marked it as spam. Avoid emailing them again without talking first." },
  failed: { label: "Failed", tone: "danger", meaning: "Couldn't be sent after retries. You can retry it." },
  suppressed: { label: "Not sent (sandbox/test mode)", tone: "warn", meaning: "Deliberately not sent, e.g. test mode, a revoked invitation or a recipient who lost access. See the note." },
};

const EVENT: Record<string, string> = {
  invitation: "Invitation",
  week_published: "Weekly guide published",
  announcement: "Announcement",
  session_published: "Office hours published",
  session_changed: "Office hours changed",
  session_cancelled: "Office hours cancelled",
};
const eventLabel = (t: string) => EVENT[t] ?? t.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());

export default async function DeliveryPage({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/delivery`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  const page = Number(one(sp.page)) || 1;
  const data = await listCohortOutbox(account, cohort.id, { state: one(sp.state), page });
  const tz = cohort.timezone;
  const base = `/manage/cohorts/${cohort.id}/delivery`;
  const total = Object.values(data.counts).reduce((a, b) => a + (b ?? 0), 0);
  const href = (state: string | null, p = 1) => {
    const q = new URLSearchParams();
    if (state) q.set("state", state);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Email delivery" description="Every email this cohort has queued: invitations, weekly guide notices, announcements and office-hours notices. Each recipient gets their own message." />

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <FilterChip href={href(null)} active={!data.state} label={`All (${total})`} />
        {OUTBOX_STATES.filter((s) => data.counts[s]).map((s) => (
          <FilterChip key={s} href={href(s)} active={data.state === s} label={`${STATE[s].label.replace(/ \(.*\)$/, "")} (${data.counts[s]})`} />
        ))}
      </nav>

      {data.items.length === 0 ? (
        <EmptyState title={data.state ? "No emails with this status" : "No emails yet"}>
          {data.state ? <Link href={href(null)} className="font-medium text-emerald underline">Show all emails</Link> : "Emails appear here when you send invitations or choose to notify the cohort."}
        </EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-line/80">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-cream/60 text-xs uppercase tracking-wide text-ink/60">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Created</th>
                <th scope="col" className="px-3 py-2 font-semibold">Type</th>
                <th scope="col" className="px-3 py-2 font-semibold">Recipient</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2 font-semibold">Attempts</th>
                <th scope="col" className="px-3 py-2 font-semibold">Note</th>
                <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 align-top">
              {data.items.map((m) => {
                const s = STATE[m.state as string] ?? { label: m.state as string, tone: "neutral" as BadgeTone, meaning: "" };
                return (
                  <tr key={m.id as string}>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink/70">{formatInstant(m.created_at as Date, tz)}</td>
                    <td className="px-3 py-2.5">{eventLabel(m.event_type as string)}</td>
                    <td className="break-all px-3 py-2.5">{m.recipient_email as string}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-ink/70">
                      {m.attempts as number}
                      {m.attempted_at ? <span className="block text-xs text-ink/50">last {formatInstant(m.attempted_at as Date, tz)}</span> : null}
                    </td>
                    <td className="max-w-xs break-words px-3 py-2.5 text-xs text-ink/70">{(m.last_error as string) || "—"}</td>
                    <td className="px-3 py-2.5">
                      {m.state === "failed" && (
                        <ActionButton action={retryEmailAction} fields={{ cohortId: cohort.id, outboxId: m.id as string }} label="Retry" pendingLabel="Queuing…" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={data.page} hasMore={data.hasMore} hrefFor={(p) => href(data.state, p)} />

      <Card>
        <h2 className="mb-3 text-base font-semibold text-ink">What each status means</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
          {OUTBOX_STATES.map((k) => (
            <div key={k} className="contents">
              <dt>
                <Badge tone={STATE[k].tone}>{STATE[k].label}</Badge>
              </dt>
              <dd className="text-ink/70">{STATE[k].meaning}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx("rounded-full border px-3 py-1 text-xs font-semibold", active ? "border-forest bg-forest text-paper" : "border-line bg-paper text-ink/70 hover:border-forest hover:text-forest")}
    >
      {label}
    </Link>
  );
}
