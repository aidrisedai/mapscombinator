import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "../env";
import type { AuthProvider, CreateUserResult, SessionUser } from "./types";

let admin: SupabaseClient | undefined;
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const e = env();
    admin = createClient(e.SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

async function serverClient() {
  const e = env();
  const store = await cookies();
  return createServerClient(e.SUPABASE_URL!, e.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: true });
        } catch {
          // Called from a Server Component render; proxy.ts refreshes cookies.
        }
      },
    },
  });
}

export const supabaseAuth: AuthProvider = {
  async getSessionUser(): Promise<SessionUser | null> {
    const client = await serverClient();
    // getUser() validates the JWT with the auth server (not just cookie decode).
    const { data, error } = await client.auth.getUser();
    if (error || !data.user?.email) return null;
    return { subject: data.user.id, email: data.user.email.toLowerCase(), emailVerified: Boolean(data.user.email_confirmed_at) };
  },
  async signIn(email, password) {
    const client = await serverClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    return error || !data.user ? null : data.user.id;
  },
  async signOut(scope) {
    const client = await serverClient();
    await client.auth.signOut({ scope });
  },
  async createConfirmedUser(email, password): Promise<CreateUserResult> {
    const { data, error } = await supabaseAdmin().auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || error.status === 422 && msg.includes("registered")) return { ok: false, reason: "exists" };
      if (msg.includes("password")) return { ok: false, reason: "weak_password", message: error.message };
      return { ok: false, reason: "error", message: error.message };
    }
    return { ok: true, subject: data.user.id };
  },
  async generateRecoveryToken(email) {
    const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "recovery", email });
    if (error || !data.properties?.hashed_token) return null;
    return data.properties.hashed_token;
  },
  async generateEmailChangeToken(currentEmail, newEmail) {
    const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "email_change_new", email: currentEmail, newEmail });
    if (error || !data.properties?.hashed_token) return null;
    return data.properties.hashed_token;
  },
  async verifyToken(type, tokenHash) {
    const client = await serverClient();
    const { error } = await client.auth.verifyOtp({ type, token_hash: tokenHash });
    return !error;
  },
  async updatePassword(newPassword) {
    const client = await serverClient();
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  },
};
