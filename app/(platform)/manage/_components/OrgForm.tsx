"use client";

import { ActionForm, TextField } from "@/components/ui/forms";
import { updateOrganizationAction } from "../actions";

export function OrganizationForm({ v }: { v: { name: string; supportEmail: string; replyToEmail: string; invitationValidDays: number } }) {
  return (
    <ActionForm action={updateOrganizationAction} submitLabel="Save organization settings" successMessage="Organization settings saved." warnUnsaved>
      <TextField label="Organization name" name="name" required maxLength={160} defaultValue={v.name} hint="Shown in emails and invitation pages." />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Support email" name="supportEmail" type="email" optional defaultValue={v.supportEmail} hint="Where people can ask for help. A cohort's own support address takes precedence." />
        <TextField label="Reply-to email" name="replyToEmail" type="email" optional defaultValue={v.replyToEmail} hint="Default reply-to for platform emails." />
      </div>
      <TextField
        label="Invitation validity (days)"
        name="invitationValidDays"
        type="number"
        min={1}
        max={30}
        step={1}
        required
        defaultValue={String(v.invitationValidDays)}
        hint="1–30 days. Applies to invitations sent or resent from now on."
      />
    </ActionForm>
  );
}
