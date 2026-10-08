"use client";

import { useRef, useState, useTransition } from "react";
import { TimezoneSelect } from "@/components/office-hours/TimezoneSelect";
import { ActionForm, CheckboxField, SelectField, TextField, type Result } from "@/components/ui/forms";
import { Badge, buttonClass, cx } from "@/components/ui/primitives";
import { createRuleAction, previewRuleAction } from "../actions";

type PreviewSlot = { startsAt: string | Date; endsAt: string | Date; localDate: string; localTime: string; label: string; clash: boolean };
type Preview = { durationWarnings: string[]; slots: PreviewSlot[]; skipped: string[] };

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function isoWeekday(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 1;
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function RuleForm({ mentorId, defaultTimezone, today, cohorts }: { mentorId: string; defaultTimezone: string; today: string; cohorts: { id: string; name: string }[] }) {
  const [formKey, setFormKey] = useState(0);
  const [kind, setKind] = useState<"single" | "weekly">("weekly");
  const [startDate, setStartDate] = useState(today);
  const [weekday, setWeekday] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [cohortError, setCohortError] = useState<string | undefined>();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const snapshot = useRef<FormData | null>(null);
  const effectiveWeekday = weekday ?? isoWeekday(startDate);

  async function runPreview(fd: FormData): Promise<Result> {
    setPublished(null);
    setPublishError(null);
    const r = await previewRuleAction(fd);
    setCohortError(r.ok ? undefined : r.fieldErrors?.cohortIds);
    if (r.ok) {
      snapshot.current = fd;
      setPreview(r.data as Preview);
    } else setPreview(null);
    return r;
  }

  function publish() {
    const fd = snapshot.current;
    if (!fd || pending) return;
    start(async () => {
      try {
        const r = await createRuleAction(fd);
        if (!r.ok) {
          setPublishError(r.error);
          return;
        }
        setPublished(r.data.message);
        setPreview(null);
        snapshot.current = null;
        setWeekday(null);
        setFormKey((k) => k + 1);
      } catch {
        setPublishError("We couldn't reach the server, so nothing was published. Try again.");
      }
    });
  }

  const clashes = preview?.slots.filter((s) => s.clash).length ?? 0;
  const byDate = new Map<string, PreviewSlot[]>();
  for (const s of preview?.slots ?? []) byDate.set(s.localDate, [...(byDate.get(s.localDate) ?? []), s]);

  return (
    <div className="space-y-6">
      {published && (
        <p role="status" className="rounded-md border border-emerald/40 bg-emerald/5 px-3 py-2 text-sm text-success">
          {published}
        </p>
      )}
      <ActionForm key={formKey} action={runPreview} submitLabel="Preview times" pendingLabel="Generating preview…" after="none" submitVariant="secondary">
        <div className="space-y-5" onChange={() => preview && setPreview(null)}>
          <input type="hidden" name="mentorId" value={mentorId} />
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Repeats</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              {(["weekly", "single"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="accent-forest" />
                  {k === "weekly" ? "Every week" : "One date only"}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={kind === "weekly" ? "Start date" : "Date"} name="startDate" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            {kind === "weekly" && <TextField label="End date" name="endDate" type="date" required min={startDate} hint="Last date this weekly window runs." />}
          </div>
          {kind === "weekly" && (
            <SelectField
              label="Day of the week"
              name="weekday"
              value={String(effectiveWeekday)}
              onChange={(e) => setWeekday(Number(e.target.value))}
              hint="Defaults to the start date's weekday."
              options={WEEKDAYS.map((d, i) => ({ value: String(i + 1), label: d }))}
            />
          )}
          <TimezoneSelect name="timezone" label="Timezone" defaultValue={defaultTimezone} hint="The times below are local to this timezone. Founders also see their own local time." />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="From" name="startTime" type="time" required defaultValue="10:00" />
            <TextField label="Until" name="endTime" type="time" required defaultValue="12:00" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Appointment length (minutes)" name="durationMinutes" type="number" min={5} max={240} step={5} defaultValue="15" required />
            <TextField label="Buffer after each (minutes)" name="bufferMinutes" type="number" min={0} max={120} step={5} defaultValue="0" />
            <TextField label="Bookable how far ahead (days)" name="horizonDays" type="number" min={1} max={180} defaultValue="28" />
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">
              Offer to cohorts<span className="text-error" aria-hidden="true"> *</span>
            </legend>
            <p className="text-xs text-ink/60">The same time is shared across cohorts — once one team books it, it&apos;s gone everywhere.</p>
            <div className="mt-2 space-y-2">
              {cohorts.map((c) => (
                <CheckboxField key={c.id} name="cohortIds" value={c.id} label={c.name} defaultChecked={cohorts.length === 1} />
              ))}
            </div>
            {cohortError && <p className="mt-1 text-sm text-error">{cohortError}</p>}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Location" name="location" optional maxLength={300} hint="For in-person meetings." />
            <TextField label="Meeting link" name="meetingUrl" type="url" optional placeholder="https://" hint="Leave blank to use the link on your profile." />
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">If a time happens twice</legend>
            <p className="text-xs text-ink/60">This only matters on the night clocks fall back, when an hour like 1:30 AM occurs twice. Choose which one you mean.</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="ambiguousOffset" value="earlier" defaultChecked className="accent-forest" /> The earlier one (before clocks change)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="ambiguousOffset" value="later" className="accent-forest" /> The later one (after clocks change)
              </label>
            </div>
          </fieldset>
        </div>
      </ActionForm>

      {preview && (
        <section aria-labelledby="preview-h" className="space-y-4 rounded-lg border border-forest/30 bg-cream/40 p-4">
          <h3 id="preview-h" className="font-semibold text-ink">
            Preview: {preview.slots.length} bookable time{preview.slots.length === 1 ? "" : "s"}
          </h3>
          {preview.durationWarnings.map((w) => (
            <p key={w} className="rounded-md border border-[#f0c987] bg-[#fff8ec] px-3 py-2 text-sm">{w}</p>
          ))}
          {preview.skipped.length > 0 && (
            <div className="rounded-md border border-[#f0c987] bg-[#fff8ec] px-3 py-2 text-sm">
              <p className="font-semibold">Skipped times that don&apos;t exist</p>
              <ul className="mt-1 list-disc pl-5">
                {preview.skipped.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}
          {clashes > 0 && (
            <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
              {clashes} time{clashes === 1 ? "" : "s"} overlap availability, appointments or sessions you already have. Adjust the window so offers don&apos;t compete, then preview again.
            </p>
          )}
          {preview.slots.length === 0 ? (
            <p className="text-sm text-ink/70">These settings don&apos;t produce any bookable times within the booking window. Check the dates, weekday and horizon.</p>
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {[...byDate.entries()].map(([d, list]) => (
                <div key={d}>
                  <ul className="flex flex-wrap gap-2">
                    {list.map((s) => (
                      <li key={new Date(s.startsAt).toISOString()} className={cx("rounded-md border px-2.5 py-1 text-xs", s.clash ? "border-error/40 bg-error/5 text-error" : "border-line bg-paper text-ink/80")}>
                        {s.label} {s.clash && <Badge tone="danger">Clash</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {publishError && (
            <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{publishError}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={buttonClass("primary")} onClick={publish} disabled={pending || clashes > 0 || preview.slots.length === 0}>
              {pending ? "Publishing…" : "Publish availability"}
            </button>
            <button type="button" className={buttonClass("ghost")} onClick={() => setPreview(null)} disabled={pending}>
              Keep editing
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
