import "server-only";
import { sql, type Db } from "../db";

export type Organization = { id: string; name: string; supportEmail: string | null; replyToEmail: string | null; invitationValidDays: number };

export async function getOrganization(db: Db = sql(), id?: string): Promise<Organization | null> {
  const [o] = id ? await db`select * from organizations where id = ${id}` : await db`select * from organizations order by created_at limit 1`;
  if (!o) return null;
  return { id: o.id, name: o.name, supportEmail: o.support_email, replyToEmail: o.reply_to_email, invitationValidDays: o.invitation_valid_days };
}
