"use client";

import { ActionForm, TextField } from "@/components/ui/forms";
import { resetPasswordAction } from "../actions";

export function ResetForm() {
  return (
    <ActionForm action={resetPasswordAction} submitLabel="Save new password" after="none">
      <TextField label="New password" name="password" type="password" autoComplete="new-password" minLength={10} hint="At least 10 characters. A short phrase is easiest to remember." required />
      <TextField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
    </ActionForm>
  );
}
