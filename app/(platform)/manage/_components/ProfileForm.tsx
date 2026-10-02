"use client";

import { ActionForm, TextAreaField, TextField } from "@/components/ui/forms";
import { updateStartupProfileAction } from "../actions";

export function StartupProfileForm({ cohortId, enrollmentId, v }: { cohortId: string; enrollmentId: string; v: { name: string; description: string; website: string; contactName: string; contactEmail: string } }) {
  return (
    <ActionForm action={updateStartupProfileAction} submitLabel="Save profile" successMessage="Profile saved." warnUnsaved>
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <TextField label="Startup name" name="name" required maxLength={120} defaultValue={v.name} />
      <TextAreaField label="Short description" name="description" required maxLength={500} rows={3} defaultValue={v.description} />
      <TextField label="Website or product link" name="website" type="url" optional defaultValue={v.website} placeholder="https://" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Primary contact name" name="contactName" required maxLength={120} defaultValue={v.contactName} />
        <TextField label="Primary contact email" name="contactEmail" type="email" required defaultValue={v.contactEmail} />
      </div>
      <p className="text-xs text-ink/60">Changing the contact email doesn&apos;t transfer anyone&apos;s account or access. To give a new person access, invite them separately.</p>
    </ActionForm>
  );
}
