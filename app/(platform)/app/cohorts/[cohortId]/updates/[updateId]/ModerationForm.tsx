"use client";

import { ActionForm, TextField } from "@/components/ui/forms";
import { moderateAction } from "../actions";

export function ModerationForm({ cohortId, updateId, hidden }: { cohortId: string; updateId: string; hidden: boolean }) {
  return (
    <ActionForm action={moderateAction} submitLabel={hidden ? "Show in cohort journal again" : "Hide from cohort journal"} submitVariant={hidden ? "secondary" : "danger"} successMessage="Saved.">
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="updateId" value={updateId} />
      <input type="hidden" name="hide" value={hidden ? "0" : "1"} />
      {!hidden && <TextField label="Reason" name="reason" maxLength={500} required />}
    </ActionForm>
  );
}
