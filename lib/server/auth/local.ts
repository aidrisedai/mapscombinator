import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { sql } from "../db";
import type { AuthProvider, SessionUser } from "./types";

/**
 * DEVELOPMENT/TEST ONLY credential adapter (AUTH_PROVIDER=local). It uses
 * Node's built-in scrypt and CSPRNG, but production must use Supabase Auth;
 * lib/server/env.ts rejects this adapter for staging/production.
 */
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "maps_dev_session";
const SESSION_DAYS = 7;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}
async function checkPassword(pw: string, stored: string) {
  const [, saltHex, keyHex] = stored.split("$");
  const key = await scrypt(pw, Buffer.from(saltHex, "hex"), 64);
  return timingSafeEqual(key, Buffer.from(keyHex, "hex"));
}

async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await sql()`insert into local_auth_sessions (token_hash, user_id, expires_at) values (${sha(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}))`;
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400, secure: process.env.APP_URL?.startsWith("https://") });
}

async function currentToken() {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

async function currentUserId() {
  const token = await currentToken();
  if (!token) return null;
  const [row] = await sql()`select user_id from local_auth_sessions where token_hash = ${sha(token)} and expires_at > now()`;
  return (row?.user_id as string) ?? null;
}

async function issueToken(userId: string, type: "recovery" | "email_change", newEmail?: string) {
  const token = randomBytes(32).toString("base64url");
  await sql()`insert into local_auth_tokens (token_hash, user_id, type, new_email, expires_at) values (${sha(token)}, ${userId}, ${type}, ${newEmail ?? null}, now() + interval '1 hour')`;
  return token;
}

export const localAuth: AuthProvider = {
  async getSessionUser(): Promise<SessionUser | null> {
    const id = await currentUserId();
    if (!id) return null;
    const [u] = await sql()`select id, email from local_auth_users where id = ${id}`;
    return u ? { subject: `local:${u.id}`, email: u.email as string, emailVerified: true } : null;
  },
  async signIn(email, password) {
    const [u] = await sql()`select id, password_hash from local_auth_users where email = ${email.toLowerCase()}`;
    if (!u) {
      await hashPassword(password); // equalize timing
      return null;
    }
    if (!(await checkPassword(password, u.password_hash as string))) return null;
    await startSession(u.id as string);
    return `local:${u.id}`;
  },
  async signOut(scope) {
    const token = await currentToken();
    if (!token) return;
    if (scope === "local") {
      await sql()`delete from local_auth_sessions where token_hash = ${sha(token)}`;
      (await cookies()).delete(COOKIE);
    } else {
      const id = await currentUserId();
      if (id) await sql()`delete from local_auth_sessions where user_id = ${id} and token_hash <> ${sha(token)}`;
    }
  },
  async createConfirmedUser(email, password) {
    const [existing] = await sql()`select id from local_auth_users where email = ${email}`;
    if (existing) return { ok: false, reason: "exists" };
    const [u] = await sql()`insert into local_auth_users (email, password_hash) values (${email}, ${await hashPassword(password)}) returning id`;
    return { ok: true, subject: `local:${u.id}` };
  },
  async generateRecoveryToken(email) {
    const [u] = await sql()`select id from local_auth_users where email = ${email.toLowerCase()}`;
    return u ? issueToken(u.id as string, "recovery") : null;
  },
  async generateEmailChangeToken(currentEmail, newEmail) {
    const [u] = await sql()`select id from local_auth_users where email = ${currentEmail}`;
    const [taken] = await sql()`select 1 from local_auth_users where email = ${newEmail}`;
    if (!u || taken) return null;
    return issueToken(u.id as string, "email_change", newEmail);
  },
  async verifyToken(type, token) {
    const rows = await sql()`
      update local_auth_tokens set used_at = now()
      where token_hash = ${sha(token)} and type = ${type} and used_at is null and expires_at > now()
      returning user_id, new_email`;
    if (!rows[0]) return false;
    if (type === "email_change") await sql()`update local_auth_users set email = ${rows[0].new_email as string} where id = ${rows[0].user_id as string}`;
    await startSession(rows[0].user_id as string);
    return true;
  },
  async updatePassword(newPassword) {
    const id = await currentUserId();
    if (!id) return { ok: false, message: "Your session expired. Request a new reset link." };
    await sql()`update local_auth_users set password_hash = ${await hashPassword(newPassword)}, password_changed_at = now() where id = ${id}`;
    return { ok: true };
  },
};
