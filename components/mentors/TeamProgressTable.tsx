import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { formatInstant } from "@/lib/time";

export type ProgressRow = { id: string; name: string; dailies: number; weekly: boolean; weekliesPosted: number; total: number; lastPublished: Date | null };

/** Per-team progress for one program week, from published updates only. */
export function TeamProgressTable({ rows, cohortId, week, tz }: { rows: ProgressRow[]; cohortId: string; week: number; tz: string }) {
  if (rows.length === 0) return <p className="text-sm text-ink/60">No startups are enrolled yet.</p>;
  return (
    <div className="relative overflow-x-auto rounded-lg border border-line/80">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="bg-cream/60 text-xs uppercase tracking-wide text-ink/60">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Startup</th>
            <th scope="col" className="px-3 py-2 font-semibold">Daily updates · Week {week}</th>
            <th scope="col" className="px-3 py-2 font-semibold">Weekly summary</th>
            <th scope="col" className="px-3 py-2 font-semibold">Summaries so far</th>
            <th scope="col" className="px-3 py-2 font-semibold">Last update</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="px-3 py-2.5">
                <Link href={`/app/cohorts/${cohortId}/startups/${t.id}`} className="font-semibold text-forest hover:text-emerald">{t.name}</Link>
              </td>
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <span className="flex gap-0.5" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={`h-2 w-4 rounded-sm ${i < Math.min(t.dailies, 5) ? "bg-emerald" : "bg-line"}`} />
                    ))}
                  </span>
                  {t.dailies}
                </span>
              </td>
              <td className="px-3 py-2.5">{t.weekly ? <Badge tone="published">Posted</Badge> : <Badge tone="warn">Not yet</Badge>}</td>
              <td className="px-3 py-2.5 text-ink/80">{t.weekliesPosted} of {week}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-ink/70">{t.lastPublished ? formatInstant(t.lastPublished, tz) : "No updates yet"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
