import Link from "next/link";
import { Badge, ExternalLink, Prose } from "@/components/ui/primitives";
import type { UpdateRow } from "@/lib/server/domain/updates";
import { formatDate, formatInstant } from "@/lib/time";

const LABELS: Record<string, string> = {
  moved: "Moved forward",
  next: "Next",
  blockers: "Blockers / help needed",
  accomplished: "Accomplished",
  learned: "Learned",
  nextCommitments: "Next week's commitments",
};
const ORDER = { daily: ["moved", "next", "blockers"], weekly: ["accomplished", "learned", "nextCommitments", "blockers"] };

export function UpdateCard({ u, cohortId, tz, showStartup = true, compact = false }: { u: UpdateRow; cohortId: string; tz: string; showStartup?: boolean; compact?: boolean }) {
  return (
    <article className={`rounded-lg border bg-paper p-5 ${u.state === "draft" ? "border-dashed border-sand" : "border-line/80"}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {showStartup && (
          <Link href={`/app/cohorts/${cohortId}/startups/${u.enrollmentId}`} className="font-semibold text-forest hover:text-emerald">
            {u.startupName}
          </Link>
        )}
        <Badge tone={u.kind === "weekly" ? "info" : "neutral"}>{u.kind === "weekly" ? `Week ${u.weekNumber} summary` : "Daily"}</Badge>
        {u.state === "draft" && <Badge tone="draft">Private draft</Badge>}
        {u.hidden && <Badge tone="danger">Hidden by administrator</Badge>}
        <span className="text-sm text-ink/60">{u.kind === "daily" && u.reportDate ? formatDate(u.reportDate) : `Week ${u.weekNumber}`}</span>
      </header>
      <div className={`mt-3 space-y-3 ${compact ? "line-clamp-6" : ""}`}>
        {ORDER[u.kind].map((k) =>
          u.content[k] ? (
            <div key={k}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">{LABELS[k]}</h3>
              <Prose text={u.content[k]} className="mt-0.5" />
            </div>
          ) : null,
        )}
        {u.content.link && (
          <p className="text-sm">
            <span className="text-ink/50">Evidence: </span>
            <ExternalLink href={u.content.link} />
          </p>
        )}
      </div>
      {u.hidden && <p className="mt-3 rounded bg-error/5 px-3 py-2 text-xs text-ink/70">Hidden from the cohort: {u.hidden.reason}</p>}
      <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/50">
        <span>By {u.createdBy}{u.lastEditor !== u.createdBy ? `, edited by ${u.lastEditor}` : ""}</span>
        {u.lastPublishedAt && <span>Published {formatInstant(u.firstPublishedAt ?? u.lastPublishedAt, tz)}</span>}
        {u.editedAfterPublish && <span>· Edited</span>}
        {u.state === "draft" && <span>Last saved {formatInstant(u.updatedAt, tz)}</span>}
        <Link href={`/app/cohorts/${cohortId}/updates/${u.id}`} className="ml-auto font-medium text-emerald hover:text-forest">
          Open
        </Link>
      </footer>
    </article>
  );
}
