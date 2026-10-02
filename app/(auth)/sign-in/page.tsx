import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/server/session";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const v = await getViewer();
  if (v.account) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/app");
  return (
    <>
      <h1 className="font-display text-2xl font-bold text-forest">Sign in</h1>
      <p className="mt-2 text-sm text-ink/70">Use the email address your program invitation was sent to.</p>
      <div className="mt-6">
        <SignInForm next={next ?? ""} />
      </div>
      <p className="mt-6 text-sm">
        <Link href="/forgot-password" className="font-medium text-emerald hover:text-forest">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-4 text-xs text-ink/60">Accounts are invitation-only. If you were expecting access, ask your program administrator for an invitation.</p>
    </>
  );
}
