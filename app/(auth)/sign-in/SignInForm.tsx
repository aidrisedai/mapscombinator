"use client";

import { ActionForm, TextField } from "@/components/ui/forms";
import { signInAction } from "../actions";

export function SignInForm({ next }: { next: string }) {
  return (
    <ActionForm action={signInAction} submitLabel="Sign in" pendingLabel="Signing in…" after="none">
      <input type="hidden" name="next" value={next} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
    </ActionForm>
  );
}
