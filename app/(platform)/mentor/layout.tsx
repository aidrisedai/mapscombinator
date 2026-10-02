import { Suspense } from "react";
import { requirePageAccount } from "@/lib/server/session";
import { MentorTabs } from "./MentorTabs";

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccount("/mentor/appointments");
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald">Mentor</p>
      <Suspense fallback={<div className="mb-6 h-10 border-b border-line" />}>
        <MentorTabs />
      </Suspense>
      {children}
    </div>
  );
}
