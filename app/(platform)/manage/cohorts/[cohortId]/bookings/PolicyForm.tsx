"use client";

import { ActionForm, TextField } from "@/components/ui/forms";
import { updatePolicyAction } from "./actions";

export function PolicyForm({ cohortId, allowedDurations, horizonDays, cancellationWindowMinutes, activeBookingLimit }: { cohortId: string; allowedDurations: number[]; horizonDays: number; cancellationWindowMinutes: number; activeBookingLimit: number }) {
  return (
    <ActionForm action={updatePolicyAction} submitLabel="Save policy" pendingLabel="Saving…" successMessage="Policy saved. It applies to bookings made from now on." warnUnsaved>
      <input type="hidden" name="cohortId" value={cohortId} />
      <TextField
        label="Allowed appointment lengths (minutes)"
        name="allowedDurations"
        required
        defaultValue={allowedDurations.join(", ")}
        hint="Comma-separated, e.g. 15, 30. Mentor times of other lengths aren't offered in this cohort."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Booking window (days ahead)" name="horizonDays" type="number" min={1} max={180} required defaultValue={String(horizonDays)} />
        <TextField
          label="Founder cancellation cutoff (minutes before start)"
          name="cancellationWindowMinutes"
          type="number"
          min={0}
          max={10080}
          required
          defaultValue={String(cancellationWindowMinutes)}
          hint="120 = two hours. Later changes go through an administrator."
        />
        <TextField label="Upcoming appointments per startup" name="activeBookingLimit" type="number" min={1} max={50} required defaultValue={String(activeBookingLimit)} />
      </div>
    </ActionForm>
  );
}
