"use client";

import { TimezoneSelect } from "@/components/office-hours/TimezoneSelect";
import { ActionForm, TextAreaField, TextField } from "@/components/ui/forms";
import { updateMentorProfileAction } from "../actions";

export function ProfileForm({
  mentorId,
  self,
  displayName,
  headline,
  bio,
  expertise,
  interests,
  linkedinUrl,
  calendarUrl,
  contactEmail,
  phone,
  accountEmail,
  timezone,
  meetingUrl,
  meetingInstructions,
}: {
  mentorId: string;
  self: boolean;
  displayName: string;
  headline: string;
  bio: string;
  expertise: string;
  interests: string;
  linkedinUrl: string;
  calendarUrl: string;
  contactEmail: string;
  phone: string;
  accountEmail: string;
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
      <TextField label="Headline" name="headline" defaultValue={headline} maxLength={160} optional placeholder="e.g. Partner at Cascade Ventures · ex-VP Sales, Zillow" hint="One line under your name." />
      <TextField label="LinkedIn profile" name="linkedinUrl" type="url" defaultValue={linkedinUrl} optional placeholder="https://www.linkedin.com/in/your-name" />
      <TextAreaField label="Short bio" name="bio" defaultValue={bio} maxLength={1500} rows={5} optional hint="What you've done and where you can help. Founders read this before booking." />
      <TextField label="Areas of expertise" name="expertise" defaultValue={expertise} optional hint="Separate with commas, e.g. Pricing, B2B sales, Fundraising. Up to 12." />
      <TextAreaField
        label="Interests"
        name="interests"
        defaultValue={interests}
        maxLength={1000}
        rows={3}
        optional
        hint="The kinds of startups, sectors or problems you'd most like to help with."
      />
      <fieldset className="space-y-4 rounded-md border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Contact and scheduling</legend>
        <p className="text-xs text-ink/60">Shown only to founders and the program team in the cohorts you mentor. All optional.</p>
        <TextField label="Calendar link" name="calendarUrl" type="url" defaultValue={calendarUrl} optional placeholder="https://calendly.com/your-name" hint="Calendly, Google Calendar booking page, Cal.com… Founders can also book the times you publish here under Availability." />
        <TextField label="Contact email" name="contactEmail" type="email" defaultValue={contactEmail} optional autoComplete="email" placeholder={accountEmail} hint="Leave blank to keep your email private. It doesn't change your sign-in email." />
        <TextField label="Phone" name="phone" type="tel" defaultValue={phone} optional autoComplete="tel" placeholder="+1 206 555 0100" />
      </fieldset>
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
