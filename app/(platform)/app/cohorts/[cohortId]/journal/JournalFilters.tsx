"use client";

import { usePathname, useRouter } from "next/navigation";
import { inputClass } from "@/components/ui/forms";

export function JournalFilters({ kind, week, startup, weekCount, startups }: { kind: string; week: string; startup: string; weekCount: number; startups: { id: string; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const go = (next: Record<string, string>) => {
    const u = new URLSearchParams();
    const v = { kind, week, startup, ...next };
    if (v.kind && v.kind !== "all") u.set("kind", v.kind);
    if (v.week) u.set("week", v.week);
    if (v.startup) u.set("startup", v.startup);
    router.push(`${path}${u.toString() ? `?${u}` : ""}`);
  };
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Show</legend>
        <div className="flex rounded-md border border-line p-0.5 text-sm">
          {[["all", "All"], ["daily", "Daily"], ["weekly", "Weekly"]].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={kind === v} onClick={() => go({ kind: v })} className={`rounded px-3 py-1.5 font-medium ${kind === v ? "bg-forest text-paper" : "text-ink/70 hover:text-forest"}`}>
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="f-startup" className="mb-1.5 block text-sm font-semibold">Startup</label>
        <select id="f-startup" className={`${inputClass} w-auto`} value={startup} onChange={(e) => go({ startup: e.target.value })}>
          <option value="">All startups</option>
          {startups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-week" className="mb-1.5 block text-sm font-semibold">Week</label>
        <select id="f-week" className={`${inputClass} w-auto`} value={week} onChange={(e) => go({ week: e.target.value })}>
          <option value="">All weeks</option>
          {Array.from({ length: weekCount }, (_, i) => <option key={i} value={i + 1}>Week {i + 1}</option>)}
        </select>
      </div>
    </div>
  );
}
