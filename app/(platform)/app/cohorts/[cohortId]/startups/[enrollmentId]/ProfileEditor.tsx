"use client";

import { ActionForm, TextAreaField, TextField } from "@/components/ui/forms";
import { updateProfileAction } from "../../updates/actions";

export function ProfileEditor({ cohortId, enrollmentId, name, description, website }: { cohortId: string; enrollmentId: string; name: string; description: string; website: string }) {
  return (
    <ActionForm action={updateProfileAction} submitLabel="Save profile" successMessage="Profile saved." warnUnsaved>
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <TextField label="Startup name" name="name" defaultValue={name} maxLength={120} required />
      <TextAreaField label="Short description" name="description" defaultValue={description} maxLength={500} rows={4} required />
      <TextField label="Website" name="website" type="url" defaultValue={website} placeholder="https://" optional />
    </ActionForm>
  );
}
