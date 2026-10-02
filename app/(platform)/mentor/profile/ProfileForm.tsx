"use client";

import { TimezoneSelect } from "@/components/office-hours/TimezoneSelect";
import { ActionForm, TextAreaField, TextField } from "@/components/ui/forms";
import { updateMentorProfileAction } from "../actions";

export function ProfileForm({
  mentorId,
  self,
  displayName,
  bio,
  expertise,
  timezone,
  meetingUrl,
  meetingInstructions,
}: {
  mentorId: string;
  self: boolean;
  displayName: string;
  bio: string;
  expertise: string;
  timezone: string;
  meetingUrl: string;
  meetingInstructions: string;
}) {
  return (
    <ActionForm action={updateMentorProfileAction} submitLabel="Save profile" pendingLabel="Saving…" successMessage="Profile saved." warnUnsaved>
      <input type="hidden" name="mentorId" value={mentorId} />
      {self ? (
        <TextField label="Display name" name="displayName" defaultValue={displayName} maxLength={120} required autoComplete="name" hint="Shown to founders on your mentor card and appointments." />
      ) : (
        <p className="text-sm text-ink/70">
          Display name: <strong>{displayName}</strong> <span className="text-ink/50">(only the mentor can change their name)</span>
        </p>
      )}
      <TextAreaField label="Short bio" name="bio" defaultValue={bio} maxLength={1500} rows={5} optional hint="What you've done and where you can help. Founders read this before booking." />
      <TextField label="Areas of expertise" name="expertise" defaultValue={expertise} optional hint="Separate with commas, e.g. Pricing, B2B sales, Fundraising. Up to 12." />
      <TimezoneSelect name="timezone" label="Appointment timezone" defaultValue={timezone} hint="Default for new availability and the date of exceptions." />
      <TextField label="Default meeting link" name="meetingUrl" type="url" defaultValue={meetingUrl} optional placeholder="https://" hint="Used when an availability window doesn't have its own link. Shown only to teams with an appointment." />
      <TextAreaField
        label="Meeting instructions"
        name="meetingInstructions"
        defaultValue={meetingInstructions}
        maxLength={1000}
        rows={3}
        optional
        hint="E.g. “Join 2 minutes early; I'll admit you from the waiting room.” Shown before booking and on appointments."
      />
    </ActionForm>
  );
}
