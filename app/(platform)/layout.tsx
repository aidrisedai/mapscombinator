import Link from "next/link";
import { sql } from "@/lib/server/db";
import { requirePageAccount } from "@/lib/server/session";
import { signOutAction } from "../(auth)/actions";
import { PlatformNav } from "@/components/ui/PlatformNav";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const account = await requirePageAccount();
  const [roles] = await sql()`
    select bool_or(role = 'admin') as admin, bool_or(role = 'mentor') as mentor
    from cohort_roles where account_id = ${account.id} and active`;
  const links = [{ href: "/app", label: "My program" }];
  if (roles?.mentor) links.push({ href: "/mentor/appointments", label: "Mentor" });
  if (account.isOwner || roles?.admin) links.push({ href: "/manage/cohorts", label: "Manage" });
  return (
    <div className="flex min-h-full flex-1 flex-col bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-forest focus:px-4 focus:py-2 focus:text-paper">
        Skip to main content
      </a>
      <header className="border-b border-line/70 bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/app" className="font-display text-lg font-bold text-forest">
            MAPS Combinator
          </Link>
          <PlatformNav links={links} />
          <div className="flex items-center gap-3 text-sm">
            <Link href="/app/account" className="max-w-[12rem] truncate text-ink/70 hover:text-forest" title={account.email}>
              {account.displayName}
            </Link>
            <form action={signOutAction}>
              <button className="rounded-md px-2 py-1 font-medium text-emerald hover:bg-cream hover:text-forest">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
