import "server-only";
import { z } from "zod";
import { email, requiredText } from "@/lib/validation";
import { audit } from "../audit";
import { sql, tx, type Db } from "../db";
import { forbidden } from "../errors";
import type { Account } from "../session";
import { parse } from "./validate";

export type Organization = { id: string; name: string; supportEmail: string | null; replyToEmail: string | null; invitationValidDays: number };

export async function getOrganization(db: Db = sql(), id?: string): Promise<Organization | null> {
  const [o] = id ? await db`select * from organizations where id = ${id}` : await db`select * from organizations order by created_at limit 1`;
  if (!o) return null;
  return { id: o.id, name: o.name, supportEmail: o.support_email, replyToEmail: o.reply_to_email, invitationValidDays: o.invitation_valid_days };
}

const optionalEmail = z.union([z.literal(""), email]).optional().transform((v) => v || null);
const orgSchema = z.object({
  name: requiredText(160, "Organization name"),
  supportEmail: optionalEmail,
  replyToEmail: optionalEmail,
  invitationValidDays: z.coerce.number().int("Use a whole number of days.").min(1, "At least 1 day.").max(30, "At most 30 days."),
});
export type OrganizationInput = z.input<typeof orgSchema>;

/** Owner-only organization settings (name, support/reply-to, invitation validity). */
export async function updateOrganization(actor: Account, input: OrganizationInput) {
  if (!actor.isOwner) throw forbidden("Only platform owners can change organization settings.");
  const v = parse(orgSchema, input);
  await tx(async (t) => {
    await t`update organizations set name = ${v.name}, support_email = ${v.supportEmail}, reply_to_email = ${v.replyToEmail},
            invitation_valid_days = ${v.invitationValidDays}, updated_at = now() where id = ${actor.organizationId}`;
    await audit(t, { actorId: actor.id, action: "organization.update", objectType: "organization", objectId: actor.organizationId, summary: { invitationValidDays: v.invitationValidDays } });
  });
}

export async function listOwners(actor: Account) {
  if (!actor.isOwner) throw forbidden();
  return sql()`select id, email, display_name, state, created_at from accounts
               where organization_id = ${actor.organizationId} and is_owner order by display_name`;
}

export const ACCOUNTS_PAGE_SIZE = 25;

/** All accounts in the organization, searchable by email (owners only). */
export async function listAccounts(actor: Account, f: { q?: string; page?: number }) {
  if (!actor.isOwner) throw forbidden();
  const q = (f.q ?? "").trim().toLowerCase().slice(0, 254);
  const pattern = q ? `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
  const page = Math.max(1, Math.min(1000, Math.floor(f.page ?? 1)));
  const rows = await sql()`
    select a.id, a.email, a.display_name, a.is_owner, a.state, a.created_at,
      (select count(*)::int from cohort_roles r where r.account_id = a.id and r.active) as role_count,
      (select count(*)::int from startup_memberships m where m.account_id = a.id and m.active) as membership_count
    from accounts a
    where a.organization_id = ${actor.organizationId} and (${pattern}::text is null or a.email like ${pattern})
    order by a.email
    limit ${ACCOUNTS_PAGE_SIZE + 1} offset ${(page - 1) * ACCOUNTS_PAGE_SIZE}`;
  return { items: rows.slice(0, ACCOUNTS_PAGE_SIZE), hasMore: rows.length > ACCOUNTS_PAGE_SIZE, page, q };
}
