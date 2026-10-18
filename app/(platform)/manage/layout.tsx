import { notFound } from "next/navigation";
import { hasAnyAdminRole } from "@/lib/server/domain/cohorts";
import { countNewSubmissions } from "@/lib/server/domain/submissions";
import { ManageNav } from "./_components/ManageNav";
import { requirePageAccount } from "@/lib/server/session";

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const account = await requirePageAccount("/manage/cohorts");
  if (!(await hasAnyAdminRole(account))) notFound();
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald">Manage · {account.isOwner ? "Platform owner" : "Cohort administrator"}</p>
      <div className="mb-6">
        <ManageNav isOwner={account.isOwner} newSubmissions={await countNewSubmissions(account)} />
      </div>
      {children}
    </div>
  );
}
