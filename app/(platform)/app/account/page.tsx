import type { Metadata } from "next";
import { Card, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { requirePageAccount } from "@/lib/server/session";
import { AccountForms } from "./AccountForms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const account = await requirePageAccount("/app/account");
  const { email } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Your account" description={`Signed in as ${account.email}`} />
      {email === "changed" && <div className="mb-6"><Notice tone="success" title="Email confirmed">Your sign-in email is now {account.email}. Your startup and cohort memberships are unchanged.</Notice></div>}
      <AccountForms name={account.displayName} />
      <Card className="mt-6">
        <SectionTitle>Sessions</SectionTitle>
        <p className="text-sm text-ink/70">Changing or resetting your password signs you out on all other devices. Removing you from a cohort takes effect immediately, even on devices that are still signed in.</p>
      </Card>
    </div>
  );
}
