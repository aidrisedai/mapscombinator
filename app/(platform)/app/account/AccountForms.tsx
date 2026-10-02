"use client";

import { ActionForm, TextField } from "@/components/ui/forms";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { emailAction, nameAction, passwordAction } from "./actions";

export function AccountForms({ name }: { name: string }) {
  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Display name</SectionTitle>
        <ActionForm action={nameAction} submitLabel="Save name" successMessage="Name saved.">
          <TextField label="Name" name="name" defaultValue={name} maxLength={120} hint="Shown on updates you write." required />
        </ActionForm>
      </Card>
      <Card>
        <SectionTitle>Change sign-in email</SectionTitle>
        <ActionForm action={emailAction} submitLabel="Send confirmation link" after="reset" successMessage="If that address can be used, we sent a confirmation link to it. Your email changes only after you open that link.">
          <TextField label="New email" name="newEmail" type="email" autoComplete="email" required />
          <TextField label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
        </ActionForm>
      </Card>
      <Card>
        <SectionTitle>Change password</SectionTitle>
        <ActionForm action={passwordAction} submitLabel="Change password" after="reset" successMessage="Password changed. Other devices have been signed out.">
          <TextField label="Current password" name="current" type="password" autoComplete="current-password" required />
          <TextField label="New password" name="password" type="password" autoComplete="new-password" minLength={10} hint="At least 10 characters." required />
          <TextField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
        </ActionForm>
      </Card>
    </div>
  );
}
