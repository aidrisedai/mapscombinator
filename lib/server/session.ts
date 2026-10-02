import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { sql } from "./db";
import { AppError } from "./errors";

export type Account = {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  isOwner: boolean;
  state: "active" | "suspended";
};

export type Viewer = { account: Account } | { account: null; sessionEmail: string | null; suspended?: boolean };

function mapAccount(r: Record<string, unknown>): Account {
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    email: r.email as string,
    displayName: r.display_name as string,
    isOwner: r.is_owner as boolean,
    state: r.state as Account["state"],
  };
}

/**
 * Resolves the signed-in platform account for this request. Auth session
 * validity comes from the identity provider; account state, roles and
 * memberships are always re-read from the database (revocation is immediate).
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await auth().getSessionUser();
  if (!user) return { account: null, sessionEmail: null };
  const [row] = await sql()`select * from accounts where auth_subject = ${user.subject}`;
  if (!row) return { account: null, sessionEmail: user.email };
  // Keep the verified address in sync after a provider-verified email change.
  // Memberships are tied to the stable account id, never to the address.
  if (user.emailVerified && row.email !== user.email) {
    const [updated] = await sql()`update accounts set email = ${user.email}, updated_at = now() where id = ${row.id as string} returning *`;
    Object.assign(row, updated);
  }
  if (row.state !== "active") return { account: null, sessionEmail: user.email, suspended: true };
  return { account: mapAccount(row) };
});

export async function currentAccount(): Promise<Account | null> {
  return (await getViewer()).account;
}

/** For pages: redirect to sign-in when there is no active account. */
export async function requirePageAccount(next?: string): Promise<Account> {
  const v = await getViewer();
  if (v.account) return v.account;
  if (v.sessionEmail) redirect("/no-access");
  redirect(`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

/** For actions/route handlers: throw instead of redirect. */
export async function requireAccount(): Promise<Account> {
  const v = await getViewer();
  if (!v.account) throw new AppError("unauthenticated", "Please sign in again to continue. Your text has not been lost.");
  return v.account;
}
