import "server-only";
import { z } from "zod";
import { optionalHttps, requiredText } from "@/lib/validation";
import { audit } from "../audit";
import { assertAdminWritable, requireCohortAdmin, requireCohortRead } from "../authz";
import { sql, tx } from "../db";
import { enqueueEmail } from "../email/outbox";
import { env } from "../env";
import { conflict, invalid, notFound } from "../errors";
import type { Account } from "../session";
import { getOrganization } from "./organization";
import { cohortRecipients } from "./recipients";
import { parse } from "./validate";

const schema = z.object({
  title: requiredText(160, "Title"),
  body: requiredText(6000, "Message"),
  link: optionalHttps,
  pinned: z.enum(["on", "off", ""]).optional().transform((v) => v === "on"),
  expiresOn: z.string().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  weekNumber: z.coerce.number().int().min(0).max(52).optional().default(0),
  sessionId: z.string().uuid().optional().or(z.literal("")).transform((v) => v || null),
});

export async function saveAnnouncement(actor: Account, cohortId: string, id: string | null, input: Record<string, string>) {
  const v = parse(schema, input);
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    let weekId: string | null = null;
    if (v.weekNumber) {
      const [w] = await t`select id from program_weeks where cohort_id = ${cohortId} and number = ${v.weekNumber}`;
      if (!w) throw invalid("That week isn't in this cohort.");
      weekId = w.id;
    }
    if (v.sessionId) {
      const [s] = await t`select 1 from office_hours_sessions where id = ${v.sessionId} and cohort_id = ${cohortId}`;
      if (!s) throw invalid("That session isn't in this cohort.");
    }
    // Expiry is end of that local day in the cohort timezone.
    const expiresAt = v.expiresOn ? t`((${v.expiresOn}::date + 1)::timestamp at time zone ${a.cohort.timezone})` : null;
    if (id) {
      const rows = await t`update announcements set title = ${v.title}, body = ${v.body}, link = ${v.link}, pinned = ${v.pinned},
        expires_at = ${expiresAt}, week_id = ${weekId}, session_id = ${v.sessionId}, revision = revision + 1, updated_by = ${actor.id}, updated_at = now()
        where id = ${id} and cohort_id = ${cohortId} returning id`;
      if (!rows[0]) throw notFound();
      await audit(t, { actorId: actor.id, action: "announcement.update", objectType: "announcement", objectId: id, cohortId });
      return id;
    }
    const [row] = await t`insert into announcements (cohort_id, week_id, session_id, title, body, link, pinned, expires_at, author_id, updated_by)
      values (${cohortId}, ${weekId}, ${v.sessionId}, ${v.title}, ${v.body}, ${v.link}, ${v.pinned}, ${expiresAt}, ${actor.id}, ${actor.id}) returning id`;
    await audit(t, { actorId: actor.id, action: "announcement.create", objectType: "announcement", objectId: row.id, cohortId });
    return row.id as string;
  });
}

export async function publishAnnouncement(actor: Account, cohortId: string, id: string, opts: { sendEmail: boolean }) {
  return tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const [n] = await t`select * from announcements where id = ${id} and cohort_id = ${cohortId} for update`;
    if (!n) throw notFound();
    if (n.state === "published" && !opts.sendEmail) throw conflict("Already published.");
    await t`update announcements set state = 'published', publish_at = coalesce(publish_at, now()), updated_at = now() where id = ${id}`;
    await audit(t, { actorId: actor.id, action: "announcement.publish", objectType: "announcement", objectId: id, cohortId, summary: { email: opts.sendEmail } });
    let queued = 0;
    if (opts.sendEmail) {
      const org = (await getOrganization(t, actor.organizationId))!;
      for (const r of await cohortRecipients(t, cohortId)) {
        const ok = await enqueueEmail(t, {
          eventType: "announcement",
          template: "announcement",
          to: r.email,
          recipientAccountId: r.id,
          cohortId,
          authorizedBy: actor.id,
          payload: { org: org.name, support: a.cohort.supportEmail ?? org.supportEmail, replyTo: a.cohort.supportEmail ?? org.supportEmail, cohort: a.cohort.name, title: n.title, body: n.body, url: `${env().APP_URL}/app/cohorts/${cohortId}/announcements` },
          related: { type: "announcement", id },
          idempotencyKey: `announcement:${id}:r${n.revision}:${r.id}`,
        });
        if (ok) queued++;
      }
    }
    return { queued };
  });
}

export async function unpublishAnnouncement(actor: Account, cohortId: string, id: string) {
  await tx(async (t) => {
    const a = await requireCohortAdmin(actor, cohortId, t);
    assertAdminWritable(a);
    const rows = await t`update announcements set state = 'draft', updated_at = now() where id = ${id} and cohort_id = ${cohortId} returning id`;
    if (!rows[0]) throw notFound();
    await audit(t, { actorId: actor.id, action: "announcement.unpublish", objectType: "announcement", objectId: id, cohortId });
  });
}

export async function listAnnouncements(actor: Account, cohortId: string, opts: { includeExpired?: boolean; limit?: number } = {}) {
  const a = await requireCohortRead(actor, cohortId);
  const rows = await sql()`
    select n.*, a.display_name as author, w.number as week_number from announcements n
    join accounts a on a.id = n.author_id left join program_weeks w on w.id = n.week_id
    where n.cohort_id = ${cohortId} and n.state = 'published'
      and (${opts.includeExpired ?? false} or n.expires_at is null or n.expires_at > now())
    order by n.pinned desc, n.publish_at desc limit ${opts.limit ?? 50}`;
  return { access: a, announcements: rows };
}

export async function listAnnouncementsForAdmin(actor: Account, cohortId: string) {
  await requireCohortAdmin(actor, cohortId);
  return sql()`select n.*, a.display_name as author, w.number as week_number from announcements n
               join accounts a on a.id = n.author_id left join program_weeks w on w.id = n.week_id
               where n.cohort_id = ${cohortId} order by n.updated_at desc`;
}
