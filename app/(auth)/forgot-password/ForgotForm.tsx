"use client";

import { ActionForm, TextField } from "@/components/ui/forms";
import { forgotPasswordAction } from "../actions";

export function ForgotForm() {
  return (
    <ActionForm
      action={forgotPasswordAction}
      submitLabel="Send reset link"
      pendingLabel="Sending…"
      after="none"
      successMessage="If that email belongs to an account, a reset link is on its way. Check your inbox (and spam folder)."
    >
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
    </ActionForm>
  );
}
