import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/server/session";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const v = await getViewer();
  if (!v.account)
    return (
      <>
        <h1 className="font-display text-2xl font-bold text-forest">Link expired</h1>
        <p className="mt-2 text-sm text-ink/70">This reset session has expired or was already used.</p>
        <p className="mt-6 text-sm"><Link href="/forgot-password" className="font-medium text-emerald">Request a new reset link</Link></p>
      </>
    );
  return (
    <>
      <h1 className="font-display text-2xl font-bold text-forest">Choose a new password</h1>
      <p className="mt-2 text-sm text-ink/70">For {v.account.email}. Saving signs you out on every other device.</p>
      <div className="mt-6">
        <ResetForm />
      </div>
    </>
  );
}
