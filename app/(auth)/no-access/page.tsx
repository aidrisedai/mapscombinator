import type { Metadata } from "next";
import { getViewer } from "@/lib/server/session";
import { signOutAction } from "../actions";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage() {
  const v = await getViewer();
  return (
    <>
      <h1 className="font-display text-2xl font-bold text-forest">{"suspended" in v && v.suspended ? "Account suspended" : "No program access yet"}</h1>
      <p className="mt-2 text-sm text-ink/70">
        {"suspended" in v && v.suspended
          ? "This account has been suspended. Contact the program administrator if you think this is a mistake."
          : `You're signed in${!v.account && v.sessionEmail ? ` as ${v.sessionEmail}` : ""}, but this account isn't part of a program yet. Open the invitation email you received, or ask your program administrator to invite this address.`}
      </p>
      <form action={signOutAction} className="mt-6">
        <button className="text-sm font-medium text-emerald hover:text-forest">Sign out</button>
      </form>
    </>
  );
}
