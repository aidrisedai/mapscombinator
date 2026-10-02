"use client";

import { useState } from "react";
import { ActionForm, SelectField, TextAreaField, TextField } from "@/components/ui/forms";
import { buttonClass } from "@/components/ui/primitives";
import { createStartupAction } from "../actions";

const MAX_COFOUNDERS = 10;

function InviteButton() {
  return (
    <button type="submit" name="intent" value="invite" className={buttonClass("secondary")}>
      Save and invite primary contact
    </button>
  );
}

function ContactFields() {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-ink">Primary contact</legend>
      <p className="text-xs text-ink/60">
        The contact email is administrative contact data, not a shared login. Each founder gets their own account through their own invitation. Prefer a named founder&apos;s address over a shared team mailbox, so posts stay attributable to a person.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Contact name" name="contactName" required maxLength={120} autoComplete="off" />
        <TextField label="Contact email" name="contactEmail" type="email" required autoComplete="off" />
      </div>
    </fieldset>
  );
}

function Cofounders() {
  const [rows, setRows] = useState<number[]>([]);
  const [next, setNext] = useState(0);
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-ink">
        Additional cofounders <span className="font-normal text-ink/50">(optional)</span>
      </legend>
      <p className="text-xs text-ink/60">Saved as contacts so you can invite each of them from the startup page. Nobody is emailed until you confirm an invitation.</p>
      {rows.map((id, i) => (
        <div key={id} className="grid items-end gap-3 rounded-md border border-line/70 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <TextField label={`Cofounder ${i + 1} name`} name={`cofounders.${i}.name`} maxLength={120} autoComplete="off" />
          <TextField label={`Cofounder ${i + 1} email`} name={`cofounders.${i}.email`} type="email" autoComplete="off" />
          <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setRows(rows.filter((r) => r !== id))} aria-label={`Remove cofounder ${i + 1}`}>
            Remove
          </button>
        </div>
      ))}
      {rows.length < MAX_COFOUNDERS ? (
        <button
          type="button"
          className={buttonClass("ghost", "sm")}
          onClick={() => {
            setRows([...rows, next]);
            setNext(next + 1);
          }}
        >
          + Add a cofounder
        </button>
      ) : (
        <p className="text-xs text-ink/60">You can add up to {MAX_COFOUNDERS} cofounders here. Add more later from the startup page.</p>
      )}
    </fieldset>
  );
}

export function CreateStartupForm({ cohortId }: { cohortId: string }) {
  return (
    <ActionForm action={createStartupAction} submitLabel="Save startup" pendingLabel="Saving…" after="none" warnUnsaved footer={<InviteButton />}>
      <input type="hidden" name="cohortId" value={cohortId} />
      <TextField label="Startup name" name="name" required maxLength={120} autoComplete="off" />
      <TextAreaField label="Short description" name="description" required maxLength={500} rows={3} hint="One or two sentences other teams in the cohort will see." />
      <TextField label="Website or product link" name="website" type="url" optional placeholder="https://" hint="Must start with https://" />
      <ContactFields />
      <Cofounders />
      <p className="text-xs text-ink/60">&ldquo;Save startup&rdquo; sends nothing. &ldquo;Save and invite&rdquo; saves first, then shows you the exact invitation to confirm before anything is sent.</p>
    </ActionForm>
  );
}

export function ReenrollStartupForm({ cohortId, startups }: { cohortId: string; startups: { id: string; name: string }[] }) {
  return (
    <ActionForm action={createStartupAction} submitLabel="Re-enroll startup" pendingLabel="Saving…" after="none" footer={<InviteButton />}>
      <input type="hidden" name="cohortId" value={cohortId} />
      <SelectField label="Returning startup" name="existingStartupId" required options={startups.map((s) => ({ value: s.id, label: s.name }))} hint="Its earlier cohort history stays with that cohort; this creates a new, separate enrollment here." />
      <ContactFields />
      <Cofounders />
    </ActionForm>
  );
}
