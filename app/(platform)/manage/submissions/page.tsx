import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, PageHeader, cx, type BadgeTone } from "@/components/ui/primitives";
import { KIND_LABEL, STATUS_LABEL, answerOf, listSubmissions } from "@/lib/server/domain/submissions";
import { load, one } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";

export const metadata: Metadata = { title: "Website submissions" };

const STATUS_TONE: Record<string, BadgeTone> = { new: "warn", contacted: "info", done: "published", archived: "neutral" };
const TZ = "America/Los_Angeles";

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const account = await requirePageAccount("/manage/submissions");
  const data = await load(() => listSubmissions(account, { status: one(sp.status), kind: one(sp.kind) }));
  const href = (q: { status?: string | null; kind?: string | null }) => {
    const p = new URLSearchParams();
    const status = q.status === undefined ? data.status : q.status;
    const kind = q.kind === undefined ? data.kind : q.kind;
    if (status) p.set("status", status);
    if (kind) p.set("kind", kind);
    const s = p.toString();
    return `/manage/submissions${s ? `?${s}` : ""}`;
  };
  const open = (data.counts.new ?? 0) + (data.counts.contacted ?? 0) + (data.counts.done ?? 0);
  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link href="/manage/cohorts" className="font-medium text-emerald hover:text-forest">← Cohorts</Link>
      </p>
      <PageHeader title="Website submissions" description="Everything people send through the public website: Get Involved offers (mentors, pilot partners, volunteers, sponsors) and Combinator interest. Each one is also emailed to the program inbox." />
      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        <Chip href={href({ status: null })} active={!data.status} label={`Open (${open})`} />
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <Chip key={k} href={href({ status: k })} active={data.status === k} label={`${v} (${data.counts[k] ?? 0})`} />
        ))}
        <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
        <Chip href={href({ kind: null })} active={!data.kind} label="All types" />
        {Object.entries(KIND_LABEL).map(([k, v]) => (
          <Chip key={k} href={href({ kind: k })} active={data.kind === k} label={v} />
        ))}
      </nav>
      {data.rows.length === 0 ? (
        <EmptyState title="Nothing here">Submissions from the website&apos;s Get Involved and Combinator forms appear here.</EmptyState>
      ) : (
        <ul className="divide-y divide-line/70 rounded-lg border border-line/80 bg-paper">
          {data.rows.map((s) => {
            const a = (label: string) => answerOf(s.answers, label);
            const extra = a("Organization") || a("Area of expertise") || a("Problem they care about") || a("Details");
            return (
              <li key={s.id as string}>
                <Link href={`/manage/submissions/${s.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-cream/50 sm:flex-row sm:items-start sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-forest">{s.name as string}</span>
                      <Badge tone="neutral">{KIND_LABEL[s.kind as string]}</Badge>
                      <Badge tone="info">{s.category as string}</Badge>
                      <Badge tone={STATUS_TONE[s.status as string]}>{STATUS_LABEL[s.status as string]}</Badge>
                    </span>
                    <span className="block break-all text-sm text-ink/70">{s.email as string}{a("City") ? ` · ${a("City")}` : ""}</span>
                    {extra && <span className="mt-0.5 block truncate text-sm text-ink/60">{extra}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-ink/50">{formatInstant(s.created_at as Date, TZ)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
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
