"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { clientIp, str } from "@/lib/server/action";
import { runAction } from "@/lib/server/errors";
import { acceptAsExisting, acceptWithNewAccount, confirmEmailToken, requestPasswordReset, setNewPassword, signIn } from "@/lib/server/domain/accounts";
import { lookupInvitation, requestNewInvitation } from "@/lib/server/domain/invitations";
import { sql } from "@/lib/server/db";
import { getViewer, requireAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";

function safeNext(n: string) {
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/app";
}

export async function signInAction(fd: FormData) {
  const r = await runAction(async () => signIn(str(fd, "email"), str(fd, "password"), await clientIp()));
  if (r.ok) redirect(safeNext(str(fd, "next") || "/app"));
  return r;
}

export async function signOutAction() {
  await auth().signOut("local");
  redirect("/sign-in");
}

export async function forgotPasswordAction(fd: FormData) {
  return runAction(async () => requestPasswordReset(str(fd, "email"), await clientIp()));
}

export async function confirmTokenAction(fd: FormData) {
  let dest = "";
  const r = await runAction(async () => {
    dest = await confirmEmailToken(str(fd, "type"), str(fd, "token_hash"));
  });
  if (r.ok) redirect(dest);
  return r;
}

export async function resetPasswordAction(fd: FormData) {
  const r = await runAction(async () => {
    await requireAccount();
    await setNewPassword({ password: str(fd, "password"), confirm: str(fd, "confirm") });
  });
  if (r.ok) redirect("/app?password=updated");
  return r;
}

export async function acceptNewAction(fd: FormData) {
  let dest = "";
  const r = await runAction(async () => {
    dest = await acceptWithNewAccount(str(fd, "token"), { displayName: str(fd, "displayName"), password: str(fd, "password"), confirm: str(fd, "confirm") }, await clientIp());
  });
  if (r.ok) redirect(dest);
  return r;
}

export async function acceptExistingAction(fd: FormData) {
  let dest = "";
  const r = await runAction(async () => {
    dest = await acceptAsExisting(await requireAccount(), str(fd, "token"));
  });
  if (r.ok) redirect(dest);
  return r;
}

export async function switchAccountAction() {
  await auth().signOut("local");
  return { ok: true as const };
}

const ROLE: Record<string, string> = { owner: "Platform owner", admin: "Cohort administrator", mentor: "Mentor / advisor", viewer: "Cohort viewer", founder: "Founder" };

export type InvitationInspection =
  | { status: "invalid" }
  | {
      status: "open" | "expired" | "revoked" | "accepted";
      email: string;
      details: [string, string | null][];
      support: string | null;
      viewer: "none" | "match" | "mismatch";
      viewerEmail: string | null;
      accountExists: boolean;
    };

/** Read-only: the token arrives in a POST body (from the URL fragment), never in a logged URL. */
export async function inspectInvitationAction(fd: FormData): Promise<InvitationInspection> {
  const inv = await lookupInvitation(str(fd, "token"));
  if (!inv) return { status: "invalid" };
  const v = await getViewer();
  const viewerEmail = v.account?.email ?? null;
  const [existing] = await sql()`select 1 from accounts where email = ${inv.email}`;
  return {
    status: inv.status,
    email: inv.email,
    details: [
      ["Organization", inv.org],
      ["Cohort", inv.cohort],
      ["Startup", inv.startup],
      ["Role", ROLE[inv.role]],
      ["Invited by", inv.inviter],
      ["Expires", formatInstant(inv.expiresAt, inv.timezone)],
    ],
    support: inv.support,
    viewer: !viewerEmail ? "none" : viewerEmail === inv.email ? "match" : "mismatch",
    viewerEmail,
    accountExists: Boolean(existing),
  };
}

export async function requestInviteAction(fd: FormData) {
  return runAction(async () => requestNewInvitation(str(fd, "token")));
}
