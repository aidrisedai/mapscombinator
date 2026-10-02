"use client";

import { useState, useSyncExternalStore } from "react";
import { Field, inputClass, TextField } from "@/components/ui/forms";
import { formatDate, isIsoDate, programWeeks } from "@/lib/time";

const COMMON = ["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "Europe/London", "UTC"];

let cachedZones: string[] | null = null;
function allZones() {
  if (!cachedZones) {
    let list: string[] = [];
    try {
      list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    } catch {
      list = [];
    }
    cachedZones = Array.from(new Set([...list, ...COMMON])).sort();
  }
  return cachedZones;
}
const noopSubscribe = () => () => {};

/** Timezone select built from the browser's IANA list (server render uses a short list, then upgrades). */
export function TimezoneSelect({ name, value, onChange, id, describedBy }: { name: string; value: string; onChange: (v: string) => void; id: string; describedBy?: string }) {
  const zones = useSyncExternalStore(noopSubscribe, allZones, () => COMMON);
  const options = zones.includes(value) ? zones : [value, ...zones];
  return (
    <select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} className={inputClass}>
      {options.map((z) => (
        <option key={z} value={z}>
          {z.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}

export function WeekPreview({ startDate, weekCount }: { startDate: string; weekCount: number }) {
  const valid = isIsoDate(startDate) && Number.isInteger(weekCount) && weekCount >= 1 && weekCount <= 52;
  if (!valid)
    return <p className="rounded-md border border-dashed border-line bg-cream/40 px-4 py-3 text-sm text-ink/60">Choose a Week 1 start date and a length of 1–52 weeks to preview the program weeks.</p>;
  const weeks = programWeeks(startDate, weekCount);
  return (
    <div>
      <p className="text-sm font-semibold text-ink">Program weeks preview</p>
      <p className="mt-0.5 text-xs text-ink/60">
        Each week is seven calendar days in the cohort timezone. The program runs {formatDate(weeks[0].startDate)} – {formatDate(weeks[weeks.length - 1].endDate)}.
      </p>
      <ol className="mt-2 max-h-72 divide-y divide-line/60 overflow-y-auto rounded-md border border-line/80 text-sm">
        {weeks.map((w) => (
          <li key={w.number} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 px-3 py-1.5">
            <span className="font-medium text-forest">Week {w.number}</span>
            <span className="text-ink/70">
              {formatDate(w.startDate)} – {formatDate(w.endDate)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Week 1 start date, duration and timezone, with a live week preview.
 * When locked, values are shown read-only and submitted unchanged.
 */
export function ScheduleFields({ startDate: s0, weekCount: w0, timezone: t0, locked = false }: { startDate: string; weekCount: number; timezone: string; locked?: boolean }) {
  const [startDate, setStartDate] = useState(s0);
  const [weekCount, setWeekCount] = useState(String(w0));
  const [timezone, setTimezone] = useState(t0);
  const n = Number(weekCount);

  if (locked) {
    return (
      <div className="space-y-4">
        <input type="hidden" name="startDate" value={s0} />
        <input type="hidden" name="weekCount" value={String(w0)} />
        <input type="hidden" name="timezone" value={t0} />
        <dl className="grid gap-3 rounded-md border border-line/80 bg-cream/40 p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-medium text-ink/60">Week 1 starts</dt>
            <dd className="text-ink">{isIsoDate(s0) ? formatDate(s0) : s0}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink/60">Length</dt>
            <dd className="text-ink">{w0} weeks</dd>
          </div>
          <div>
            <dt className="font-medium text-ink/60">Timezone</dt>
            <dd className="text-ink">{t0.replaceAll("_", " ")}</dd>
          </div>
        </dl>
        <WeekPreview startDate={s0} weekCount={w0} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField label="Week 1 start date" name="startDate" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} hint="The first day of Week 1." />
        <TextField label="Duration (weeks)" name="weekCount" type="number" min={1} max={52} step={1} required value={weekCount} onChange={(e) => setWeekCount(e.target.value)} hint="1–52 weeks." />
        <Field label="Timezone" name="timezone" required hint="Program dates and times use this zone.">
          {({ id, describedBy }) => <TimezoneSelect id={id} describedBy={describedBy} name="timezone" value={timezone} onChange={setTimezone} />}
        </Field>
      </div>
      <WeekPreview startDate={startDate} weekCount={n} />
    </div>
  );
}
