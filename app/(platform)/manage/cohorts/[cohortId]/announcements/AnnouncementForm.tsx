"use client";

import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/forms";
import { OpForm } from "@/components/office-hours/OpForm";
import { saveAnnouncementAction } from "./actions";

export type AnnouncementDefaults = { title?: string; body?: string; link?: string; pinned?: boolean; expiresOn?: string; weekNumber?: number; sessionId?: string };

export function AnnouncementForm({
  cohortId,
  announcementId,
  weeks,
  sessions,
  defaults = {},
  timezone,
}: {
  cohortId: string;
  announcementId?: string;
  weeks: { number: number; label: string }[];
  sessions: { id: string; label: string }[];
  defaults?: AnnouncementDefaults;
  timezone: string;
}) {
  return (
    <OpForm action={saveAnnouncementAction} submitLabel={announcementId ? "Save changes" : "Save as draft"} pendingLabel="Saving…" warnUnsaved successMessage="Saved.">
      <input type="hidden" name="cohortId" value={cohortId} />
      {announcementId && <input type="hidden" name="announcementId" value={announcementId} />}
      <TextField label="Title" name="title" required maxLength={160} defaultValue={defaults.title} />
      <TextAreaField label="Message" name="body" required maxLength={6000} rows={7} defaultValue={defaults.body} hint="Plain text. Blank lines start new paragraphs; lines starting with “- ” become a list." />
      <TextField label="Link" name="link" type="url" optional placeholder="https://" defaultValue={defaults.link} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Related week"
          name="weekNumber"
          optional
          defaultValue={String(defaults.weekNumber ?? 0)}
          options={[{ value: "0", label: "None" }, ...weeks.map((w) => ({ value: String(w.number), label: w.label }))]}
        />
        <SelectField label="Related session" name="sessionId" optional defaultValue={defaults.sessionId ?? ""} options={[{ value: "", label: "None" }, ...sessions.map((s) => ({ value: s.id, label: s.label }))]} />
      </div>
      <TextField label="Expires after" name="expiresOn" type="date" optional defaultValue={defaults.expiresOn} hint={`Hidden from the current list after the end of this day (${timezone.replaceAll("_", " ")}). Members can still find it under “Include expired”.`} />
      <CheckboxField name="pinned" label="Pin to the top" defaultChecked={defaults.pinned} hint="Pinned announcements appear first for members." />
    </OpForm>
  );
}
