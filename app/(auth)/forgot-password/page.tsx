import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold text-forest">Reset your password</h1>
      <p className="mt-2 text-sm text-ink/70">Enter your account email. If it belongs to an account, we&apos;ll send a link that works once and expires in an hour.</p>
      <div className="mt-6">
        <ForgotForm />
      </div>
      <p className="mt-6 text-sm">
        <Link href="/sign-in" className="font-medium text-emerald hover:text-forest">Back to sign in</Link>
      </p>
    </>
  );
}
