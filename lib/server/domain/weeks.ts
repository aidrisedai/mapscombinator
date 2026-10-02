import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { formatDate } from "@/lib/time";
import { requiredText, safeHttpsUrl, text } from "@/lib/validation";
import { audit } from "../audit";
import { assertAdminWritable, requireCohortAdmin, requireCohortRead } from "../authz";
import { sql, tx, type Db } from "../db";
import { enqueueEmail } from "../email/outbox";
import { env } from "../env";
import { conflict, invalid, notFound } from "../errors";
import type { Account } from "../session";
import { accessObject, deleteObject, putObject, safeFilename, validateUpload, ALLOWED } from "../storage";
import { getOrganization } from "./organization";
import { cohortRecipients } from "./recipients";
import { parse } from "./validate";

export const MAX_FILES_PER_WEEK = 5;

const contentSchema = z.object({
  title: text(160, "Title").default(""),
  objective: text(1000, "Objective").default(""),
  instructions: text(8000, "Expected work").default(""),
  deliverable: text(2000, "Deliverable").default(""),
});

export type WeekContent = z.infer<typeof contentSchema>;

async function weekRow(cohortId: string, number: number, db: Db = sql()) {
  const [w] = await db`select * from program_weeks where cohort_id = ${cohortId} and number = ${number}`;
  if (!w) throw notFound("That week isn't part of this cohort.");
  return w;
}

async function revisionContent(id: string | null) {
  if (!id) return null;
  const [r] = await sql()`select r.*, a.display_name as author from week_content_revisions r join accounts a on a.id = r.author_id where r.id = ${id}`;
  return r ?? null;
}

/** Founder/mentor/viewer view: published content only. Admins can preview drafts. */
export async function getWeekForReader(actor: Account, cohortId: string, number: number, preview = false) {
  const a = await requireCohortRead(actor, cohortId);
  const w = await weekRow(cohortId, number);
  const usePreview = preview && a.isAdmin;
  const revId = usePreview ? (w.draft_revision_id ?? w.published_revision_id) : w.content_state === "published" ? w.published_revision_id : null;
  const content = await revisionContent(revId);
  const resources = content
    ? await sql()`select id, kind, label, url, filename, content_type, size_bytes from week_resources
                  where week_id = ${w.id} and state = 'ready' order by sort_order, created_at`
    : [];
  return { access: a, week: w, content, resources, isPreview: usePreview };
}

export async function getWeekForAdmin(actor: Account, cohortId: string, number: number) {
  const a = await requireCohortAdmin(actor, cohortId);
  const w = await weekRow(cohortId, number);
  const draft = await revisionContent(w.draft_revision_id ?? w.published_revision_id);
  const published = await revisionContent(w.published_revision_id);
  const resources = await sql()`select r.*, a.display_name as creator from week_resources r join accounts a on a.id = r.created_by
                                where r.week_id = ${w.id} and r.state in ('ready', 'pending', 'failed') order by r.sort_order, r.created_at`;
  const revisions = await sql()`select r.revision, r.created_at, a.display_name as author, (r.id = ${w.published_revision_id}) as is_published
                                from week_content_revisions r join accounts a on a.id = r.author_id where r.week_id = ${w.id} order by r.revision desc limit 20`;
  return { access: a, week: w, draft, published, resources, revisions, hasUnpublishedChanges: w.draft_revision_id && w.draft_revision_id !== w.published_revision_id };
}

/** Saves a new draft revision. Never exposes content or sends email. */
export async function saveWeekDraft(actor: Account, cohortId: string, number: number, input: Record<string, string>) {
  const v = parse(contentSchema, input);
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const [w] = await t`select * from program_weeks where cohort_id = ${cohortId} and number = ${number} for update`;
    if (!w) throw notFound();
    const [n] = await t`select coalesce(max(revision), 0) + 1 as n from week_content_revisions where week_id = ${w.id}`;
    const [r] = await t`insert into week_content_revisions (week_id, revision, title, objective, instructions, deliverable, author_id)
                        values (${w.id}, ${n.n}, ${v.title}, ${v.objective}, ${v.instructions}, ${v.deliverable}, ${actor.id}) returning id`;
    await t`update program_weeks set draft_revision_id = ${r.id}, content_state = case when content_state = 'none' then 'draft' else content_state end,
            updated_at = now() where id = ${w.id}`;
    return r.id as string;
  });
}

/** Publish the latest draft; optional email only when explicitly confirmed. */
export async function publishWeek(actor: Account, cohortId: string, number: number, opts: { sendEmail: boolean }) {
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const [w] = await t`select * from program_weeks where cohort_id = ${cohortId} and number = ${number} for update`;
    const revId = w.draft_revision_id ?? w.published_revision_id;
    if (!revId) throw invalid("Write the week's content before publishing.");
    const [rev] = await t`select * from week_content_revisions where id = ${revId}`;
    if (!rev.title.trim()) throw invalid("Give the week a title before publishing.", { title: "Required to publish." });
    await t`update program_weeks set published_revision_id = ${revId}, content_state = 'published', published_at = now(),
            first_published_at = coalesce(first_published_at, now()), updated_at = now() where id = ${w.id}`;
    await audit(t, { actorId: actor.id, action: "week.publish", objectType: "program_week", objectId: w.id, cohortId, summary: { number, revision: rev.revision, email: opts.sendEmail } });
    let queued = 0;
    if (opts.sendEmail) {
      const org = (await getOrganization(t, actor.organizationId))!;
      const recipients = await cohortRecipients(t, cohortId);
      for (const r of recipients) {
        const id = await enqueueEmail(t, {
          eventType: "week_published",
          template: "week_published",
          to: r.email,
          recipientAccountId: r.id,
          cohortId,
          authorizedBy: actor.id,
          payload: {
            org: org.name, support: a.cohort.supportEmail ?? org.supportEmail, replyTo: a.cohort.supportEmail ?? org.supportEmail,
            cohort: a.cohort.name, week: String(number), title: rev.title, objective: rev.objective || null, deliverable: rev.deliverable || null,
            dates: `${formatDate(w.start_date)} – ${formatDate(w.end_date)}`, url: `${env().APP_URL}/app/cohorts/${cohortId}/weeks/${number}`,
          },
          related: { type: "program_week", id: w.id },
          idempotencyKey: `week:${w.id}:rev${rev.revision}:${r.id}`,
        });
        if (id) queued++;
      }
    }
    return { queued };
  });
}

export async function unpublishWeek(actor: Account, cohortId: string, number: number) {
  await tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const rows = await t`update program_weeks set content_state = 'unpublished', updated_at = now()
                         where cohort_id = ${cohortId} and number = ${number} and content_state = 'published' returning id`;
    if (!rows[0]) throw conflict("This week isn't published.");
    await audit(t, { actorId: actor.id, action: "week.unpublish", objectType: "program_week", objectId: rows[0].id, cohortId, summary: { number } });
  });
}

export async function addLinkResource(actor: Account, cohortId: string, number: number, input: { label: string; url: string }) {
  const label = parse(z.object({ label: requiredText(160, "Label") }), input).label;
  const u = safeHttpsUrl(input.url);
  if (!u.ok || !u.url) throw invalid("Use a full https:// link.", { url: "Use a full https:// link." });
  await tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const w = await weekRow(cohortId, number, t);
    await t`insert into week_resources (cohort_id, week_id, kind, label, url, created_by, sort_order)
            values (${cohortId}, ${w.id}, 'link', ${label}, ${u.url}, ${actor.id}, extract(epoch from now())::int)`;
    await audit(t, { actorId: actor.id, action: "resource.add_link", objectType: "program_week", objectId: w.id, cohortId, summary: { label } });
  });
}

/**
 * Upload flow: validate → reserve a pending row → write blob → mark ready
 * (and retire the replaced resource) in one transaction. A failure leaves the
 * previous resource untouched; failed/pending rows are cleaned by the worker.
 */
export async function uploadFileResource(
  actor: Account,
  cohortId: string,
  number: number,
  file: { name: string; bytes: Buffer },
  label: string,
  replacesId?: string | null,
) {
  const a = await requireCohortAdmin(actor, cohortId);
  assertAdminWritable(a);
  const w = await weekRow(cohortId, number);
  const check = validateUpload(file.name, file.bytes, env().MAX_UPLOAD_MIB * 1048576);
  if (!check.ok) throw invalid(check.error, { file: check.error });
  const cleanLabel = (label || file.name).trim().slice(0, 160);
  if (replacesId) {
    const [old] = await sql()`select id from week_resources where id = ${replacesId} and week_id = ${w.id} and state = 'ready'`;
    if (!old) throw notFound("The file you're replacing no longer exists.");
  } else {
    const [n] = await sql()`select count(*)::int as n from week_resources where week_id = ${w.id} and kind = 'file' and state in ('ready','pending')`;
    if (n.n >= MAX_FILES_PER_WEEK) throw invalid(`Each week can have at most ${MAX_FILES_PER_WEEK} uploaded files. Remove or replace one first.`);
  }
  const key = `cohorts/${cohortId}/weeks/${w.id}/${randomUUID()}.${check.ext}`;
  const [row] = await sql()`
    insert into week_resources (cohort_id, week_id, kind, label, storage_key, filename, content_type, size_bytes, state, replaces_resource_id, created_by, sort_order)
    values (${cohortId}, ${w.id}, 'file', ${cleanLabel}, ${key}, ${safeFilename(file.name)}, ${ALLOWED[check.ext]}, ${file.bytes.length}, 'pending', ${replacesId ?? null}, ${actor.id}, extract(epoch from now())::int)
    returning id`;
  try {
    await putObject(key, file.bytes, ALLOWED[check.ext]);
  } catch (err) {
    await sql()`update week_resources set state = 'failed' where id = ${row.id}`;
    throw err;
  }
  await tx(async (t) => {
    await t`update week_resources set state = 'ready' where id = ${row.id}`;
    if (replacesId) {
      const [old] = await t`update week_resources set state = 'removed', removed_at = now() where id = ${replacesId} returning sort_order`;
      await t`update week_resources set sort_order = ${old.sort_order} where id = ${row.id}`;
    }
    await audit(t, { actorId: actor.id, action: replacesId ? "resource.replace" : "resource.upload", objectType: "week_resource", objectId: row.id, cohortId, summary: { label: cleanLabel, size: file.bytes.length } });
  });
  return row.id as string;
}

/** Removal hides the resource; the blob is retained for recovery (see DEPLOYMENT.md). */
export async function removeResource(actor: Account, cohortId: string, resourceId: string) {
  await tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const rows = await t`update week_resources set state = 'removed', removed_at = now() where id = ${resourceId} and cohort_id = ${cohortId} and state <> 'removed' returning id`;
    if (!rows[0]) throw notFound();
    await audit(t, { actorId: actor.id, action: "resource.remove", objectType: "week_resource", objectId: resourceId, cohortId });
  });
}

/** Authorized file access: readers only for published weeks; admins always. */
export async function openResource(actor: Account, resourceId: string) {
  const [r] = await sql()`select r.*, w.content_state from week_resources r join program_weeks w on w.id = r.week_id
                          where r.id = ${resourceId} and r.kind = 'file' and r.state = 'ready'`;
  if (!r) throw notFound();
  const a = await requireCohortRead(actor, r.cohort_id);
  if (!a.isAdmin && r.content_state !== "published") throw notFound();
  await audit(sql(), { actorId: actor.id, action: "resource.download", objectType: "week_resource", objectId: r.id, cohortId: r.cohort_id });
  return { resource: r, access: await accessObject(r.storage_key, r.filename) };
}

/** Worker: remove blobs of uploads that never completed (older than 1 day). */
export async function cleanupOrphanUploads() {
  const rows = await sql()`select id, storage_key from week_resources where state in ('pending','failed') and created_at < now() - interval '1 day'`;
  for (const r of rows) {
    await deleteObject(r.storage_key).catch(() => {});
    await sql()`update week_resources set state = 'removed', removed_at = now() where id = ${r.id}`;
  }
  return rows.length;
}
