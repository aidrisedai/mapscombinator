import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ui/forms";
import { Badge, Card, ExternalLink, LinkButton, Notice, SectionTitle } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { sql } from "@/lib/server/db";
import { recipientCount } from "@/lib/server/domain/recipients";
import { getWeekForAdmin, MAX_FILES_PER_WEEK } from "@/lib/server/domain/weeks";
import { env } from "@/lib/server/env";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatDate, formatInstant } from "@/lib/time";
import { removeResourceAction } from "../../../../actions";
import { AddLinkForm, PublishPanel, ReplaceToggle, UploadForm, WeekEditor } from "../../../../_components/WeekForms";
import { WeekStateBadge } from "../../../../_components/weekState";

export const metadata: Metadata = { title: "Edit week" };

function size(bytes: number) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MiB` : `${Math.max(1, Math.round(bytes / 1024))} KiB`;
}

export default async function WeekEditPage({ params }: { params: Promise<{ cohortId: string; number: string }> }) {
  const { cohortId, number } = await params;
  const n = Number(number);
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/weeks/${number}`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  if (!/^\d{1,2}$/.test(number) || n < 1 || n > cohort.weekCount) notFound();
  const { week: w, draft, published, resources, revisions, hasUnpublishedChanges } = await load(() => getWeekForAdmin(account, cohort.id, n));
  const recipients = await recipientCount(sql(), cohort.id);
  const tz = cohort.timezone;
  const base = `/manage/cohorts/${cohort.id}`;
  const writable = cohort.status !== "archived";
  const maxMib = env().MAX_UPLOAD_MIB;
  const fileCount = resources.filter((r) => r.kind === "file" && (r.state === "ready" || r.state === "pending")).length;
  const content = {
    title: (draft?.title as string) ?? "",
    objective: (draft?.objective as string) ?? "",
    instructions: (draft?.instructions as string) ?? "",
    deliverable: (draft?.deliverable as string) ?? "",
  };

  return (
    <div className="space-y-8">
      <div>
        <Link href={`${base}/weeks`} className="text-sm font-medium text-emerald hover:text-forest">
          ← All weeks
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-forest">Week {n}</h1>
              <WeekStateBadge state={w.content_state as string} />
              {hasUnpublishedChanges && w.content_state === "published" && <Badge tone="draft">Unpublished changes</Badge>}
            </div>
            <p className="mt-1 text-sm text-ink/70">
              {formatDate(w.start_date as string)} – {formatDate(w.end_date as string)}
              {published && w.published_at ? ` · Published ${formatInstant(w.published_at as Date, tz)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {n > 1 && (
              <LinkButton href={`${base}/weeks/${n - 1}`} variant="ghost" size="sm">
                ← Week {n - 1}
              </LinkButton>
            )}
            {n < cohort.weekCount && (
              <LinkButton href={`${base}/weeks/${n + 1}`} variant="ghost" size="sm">
                Week {n + 1} →
              </LinkButton>
            )}
            <LinkButton href={`/app/cohorts/${cohort.id}/weeks/${n}?preview=1`} variant="secondary" size="sm" target="_blank">
              Preview as founder
            </LinkButton>
          </div>
        </div>
      </div>

      {!writable && <Notice tone="warn" title="Read-only">This cohort is archived. Restore it to edit the weekly guide.</Notice>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <SectionTitle>Content</SectionTitle>
          {writable ? (
            <WeekEditor cohortId={cohort.id} week={n} content={content} />
          ) : (
            <p className="text-sm text-ink/70">{content.title || "No content."}</p>
          )}
        </Card>
        <div className="space-y-8">
          <Card>
            <SectionTitle>Publish</SectionTitle>
            {writable ? (
              <PublishPanel
                cohortId={cohort.id}
                week={n}
                state={w.content_state as string}
                hasContent={Boolean(draft)}
                hasUnpublishedChanges={Boolean(hasUnpublishedChanges)}
                recipients={recipients}
              />
            ) : (
              <p className="text-sm text-ink/70">Publishing is unavailable while the cohort is archived.</p>
            )}
          </Card>
          <Card>
            <SectionTitle>Revisions</SectionTitle>
            {revisions.length === 0 ? (
              <p className="text-sm text-ink/60">No saved drafts yet.</p>
            ) : (
              <ol className="space-y-1.5 text-sm">
                {revisions.map((r) => (
                  <li key={r.revision as number} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium text-ink">Revision {r.revision as number}</span>
                    {r.is_published ? <Badge tone="published">Published version</Badge> : null}
                    <span className="text-xs text-ink/60">
                      {r.author as string} · {formatInstant(r.created_at as Date, tz)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <SectionTitle>Resources</SectionTitle>
        <p className="mb-4 text-sm text-ink/70">Founders see resources once the week is published. Files are stored privately and only people in this cohort can open them.</p>
        {resources.length === 0 ? (
          <p className="mb-6 text-sm text-ink/60">No resources yet. Add a link or upload slides below.</p>
        ) : (
          <ul className="mb-6 divide-y divide-line/60 rounded-md border border-line/70">
            {resources.map((r) => (
              <li key={r.id as string} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                    {r.label as string}
                    <Badge tone="neutral">{r.kind === "link" ? "Link" : (r.filename as string)?.toLowerCase().endsWith(".pdf") ? "PDF" : "Slides"}</Badge>
                    {r.state === "pending" && <Badge tone="warn">Upload not finished</Badge>}
                    {r.state === "failed" && <Badge tone="danger">Upload failed</Badge>}
                  </p>
                  {r.kind === "link" ? (
                    <ExternalLink href={r.url as string} />
                  ) : (
                    <p className="text-xs text-ink/60">
                      {r.state === "ready" ? (
                        <a href={`/api/files/${r.id}`} className="font-medium text-emerald underline underline-offset-2 hover:text-forest">
                          {r.filename as string}
                        </a>
                      ) : (
                        (r.filename as string)
                      )}{" "}
                      · {size(Number(r.size_bytes))}
                    </p>
                  )}
                  <p className="text-xs text-ink/50">
                    Added by {r.creator as string} · {formatInstant(r.created_at as Date, tz)}
                  </p>
                </div>
                {writable && (
                  <div className="flex flex-wrap items-start gap-2 sm:max-w-md">
                    {r.kind === "file" && r.state === "ready" && <ReplaceToggle cohortId={cohort.id} week={n} maxMib={maxMib} resourceId={r.id as string} label={r.label as string} />}
                    <ActionButton
                      action={removeResourceAction}
                      fields={{ cohortId: cohort.id, resourceId: r.id as string }}
                      label="Remove"
                      pendingLabel="Removing…"
                      variant="danger"
                      confirmMessage={`Remove “${r.label as string}” from Week ${n}? Founders will no longer see it.`}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {writable && (
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold text-ink">Add a link</p>
              <AddLinkForm cohortId={cohort.id} week={n} />
            </div>
            <div>
              <p className="mb-1 text-sm font-semibold text-ink">Upload slides or a PDF</p>
              <p className="mb-3 text-xs text-ink/60">
                {fileCount} of {MAX_FILES_PER_WEEK} files used this week.
              </p>
              {fileCount >= MAX_FILES_PER_WEEK ? (
                <p className="text-sm text-ink/70">This week has the maximum of {MAX_FILES_PER_WEEK} files. Replace or remove one to add another.</p>
              ) : (
                <UploadForm cohortId={cohort.id} week={n} maxMib={maxMib} />
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
