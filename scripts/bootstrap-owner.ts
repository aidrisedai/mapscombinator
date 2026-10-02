/**
 * Secure owner bootstrap (run by an operator with database access):
 *   OWNER_EMAIL=you@example.org npm run bootstrap:owner
 * Creates the organization if missing and an owner invitation, then queues
 * the invitation email. With --print-link the single-use link is printed to
 * this terminal instead of relying on email (for first setup before the
 * sender domain is verified). There is no "first visitor becomes admin".
 */
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const appUrl = process.env.APP_URL;
  const orgName = process.env.ORGANIZATION_NAME ?? "MAPS Combinator";
  if (!url || !email || !appUrl) throw new Error("DATABASE_URL, OWNER_EMAIL and APP_URL are required");
  const printLink = process.argv.includes("--print-link");
  const sql = postgres(url, { max: 1, ssl: process.env.DATABASE_SSL === "require" ? "require" : false, onnotice: () => {} });
  try {
    await sql.begin(async (t) => {
      let [org] = await t`select * from organizations order by created_at limit 1`;
      if (!org) [org] = await t`insert into organizations (name, support_email, reply_to_email) values (${orgName}, ${process.env.EMAIL_REPLY_TO ?? null}, ${process.env.EMAIL_REPLY_TO ?? null}) returning *`;
      const [owner] = await t`select id from accounts where email = ${email} and is_owner`;
      if (owner) {
        console.log(`${email} is already a platform owner.`);
        return;
      }
      await t`update invitations set state = 'revoked', revoked_at = now() where email = ${email} and role = 'owner' and state in ('queued','sent','delivery_failed')`;
      const token = randomBytes(32).toString("base64url");
      const expires = new Date(Date.now() + org.invitation_valid_days * 86400_000);
      const [inv] = await t`insert into invitations (organization_id, email, role, token_hash, expires_at, send_count)
                            values (${org.id}, ${email}, 'owner', ${createHash("sha256").update(token).digest("hex")}, ${expires}, 1) returning id`;
      const link = `${appUrl}/accept-invitation#${token}`;
      if (printLink) {
        await t`update invitations set delivery_state = 'suppressed' where id = ${inv.id}`;
        console.log(`Owner invitation for ${email} (expires ${expires.toISOString()}):\n${link}\nOpen it, set a password, and you're in. The link works once.`);
      } else {
        await t`insert into email_outbox (event_type, template, recipient_email, payload, secret_payload, related_type, related_id, idempotency_key)
                values ('invitation', 'invitation', ${email},
                  ${t.json({ org: org.name, support: org.support_email, role: "owner", inviter: org.name, expires: expires.toUTCString(), email })},
                  ${t.json({ link })}, 'invitation', ${inv.id}, ${`invitation:${inv.id}:1`})`;
        console.log(`Owner invitation queued for ${email}. The worker sends it; check delivery under Manage → Delivery once signed in.`);
      }
    });
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
