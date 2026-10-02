import type { Metadata } from "next";
import Link from "next/link";
import { UpdateCard } from "@/components/journal/UpdateCard";
import { Badge, Card, LinkButton, SectionTitle } from "@/components/ui/primitives";
import { getUpdate, listRevisions } from "@/lib/server/domain/updates";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";
import { ModerationForm } from "./ModerationForm";

export const metadata: Metadata = { title: "Update" };

export default async function UpdatePage({ params }: { params: Promise<{ cohortId: string; updateId: string }> }) {
  const { cohortId, updateId } = await params;
  const account = await requirePageAccount(`/app/cohorts/${cohortId}/updates/${updateId}`);
  const { access, update, canSeePrivate } = await load(() => getUpdate(account, cohortId, updateId));
  const revisions = canSeePrivate ? await listRevisions(account, cohortId, updateId) : [];
  const isTeam = access.founderOf.some((f) => f.enrollmentId === update.enrollmentId);
  const tz = access.cohort.timezone;
  const editHref = `/app/cohorts/${cohortId}/updates/new?team=${update.enrollmentId}&kind=${update.kind}&${update.kind === "daily" ? `date=${update.reportDate}` : `week=${update.weekNumber}`}`;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/app/cohorts/${cohortId}/journal`} className="text-sm font-medium text-emerald hover:text-forest">← Journal</Link>
        {isTeam && access.cohort.status === "active" && <LinkButton href={editHref} variant="secondary" size="sm">Edit</LinkButton>}
      </div>
      <UpdateCard u={update} cohortId={cohortId} tz={tz} />
      {canSeePrivate && revisions.length > 0 && (
        <Card>
          <SectionTitle>Revision history</SectionTitle>
          <p className="-mt-2 mb-3 text-xs text-ink/60">Visible to the team and administrators. The cohort sees only the current published version.</p>
          <ol className="space-y-3">
            {revisions.map((r) => (
              <li key={r.revision}>
                <details className="rounded-md border border-line p-3 text-sm">
                  <summary className="cursor-pointer">
                    <span className="font-medium">Revision {r.revision}</span> · {r.author} · {formatInstant(r.created_at, tz)} <Badge tone={r.state === "published" ? "published" : "draft"}>{r.state}</Badge>
                  </summary>
                  <dl className="mt-3 space-y-2">
                    {Object.entries(r.content as Record<string, string | null>).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k}><dt className="text-xs font-semibold uppercase text-ink/50">{k}</dt><dd className="whitespace-pre-line">{v}</dd></div>
                    ))}
                  </dl>
                </details>
              </li>
            ))}
          </ol>
        </Card>
      )}
      {access.isAdmin && update.state === "published" && (
        <Card>
          <SectionTitle>Moderation</SectionTitle>
          <p className="-mt-2 mb-3 text-sm text-ink/70">Hiding removes this post from the cohort journal. The founders&apos; words are never edited; your reason is recorded in the audit log and shown to the team.</p>
          <ModerationForm cohortId={cohortId} updateId={updateId} hidden={Boolean(update.hidden)} />
        </Card>
      )}
    </div>
  );
}
