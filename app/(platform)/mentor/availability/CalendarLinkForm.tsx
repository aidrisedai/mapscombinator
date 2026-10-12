"use client";

import { OpForm } from "@/components/office-hours/OpForm";
import { TextField } from "@/components/ui/forms";
import { updateMentorCalendarAction } from "../actions";

export function CalendarLinkForm({ mentorId, calendarUrl }: { mentorId: string; calendarUrl: string }) {
  return (
    <OpForm action={updateMentorCalendarAction} submitLabel="Save booking link" pendingLabel="Saving…" successMessage="Saved.">
      <input type="hidden" name="mentorId" value={mentorId} />
      <TextField
        label="Booking link"
        name="calendarUrl"
        type="url"
        defaultValue={calendarUrl}
        optional
        placeholder="https://calendly.com/your-name/30min"
        hint="Calendly, Cal.com, a Google Calendar or Outlook booking page… Leave blank to remove it."
      />
    </OpForm>
  );
}
