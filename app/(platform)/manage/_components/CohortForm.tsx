"use client";

import { ActionForm, TextAreaField, TextField } from "@/components/ui/forms";
import { createCohortAction, updateCohortSettingsAction } from "../actions";
import { ScheduleFields } from "./ScheduleFields";

type Values = { name: string; description: string; startDate: string; weekCount: number; timezone: string; supportEmail: string };

function CommonFields({ v }: { v: Values }) {
  return (
    <>
      <TextField label="Cohort name" name="name" required maxLength={160} defaultValue={v.name} placeholder="e.g. Fall 2026 Cohort" />
      <TextAreaField label="Description" name="description" optional maxLength={2000} rows={3} defaultValue={v.description} hint="Shown to members on the cohort home." />
    </>
  );
}

function SupportField({ v }: { v: Values }) {
  return (
    <TextField
      label="Support / reply-to email"
      name="supportEmail"
      type="email"
      optional
      defaultValue={v.supportEmail}
      hint="Replies to cohort emails go here. Leave blank to use the organization's support address."
    />
  );
}

export function NewCohortForm() {
  const v: Values = { name: "", description: "", startDate: "", weekCount: 12, timezone: "America/Los_Angeles", supportEmail: "" };
  return (
    <ActionForm action={createCohortAction} submitLabel="Save as draft" pendingLabel="Creating…" after="none" warnUnsaved>
      <CommonFields v={v} />
      <ScheduleFields startDate={v.startDate} weekCount={v.weekCount} timezone={v.timezone} />
      <SupportField v={v} />
      <p className="text-xs text-ink/60">Draft cohorts aren&apos;t visible as active program work. Nobody is emailed when you save.</p>
    </ActionForm>
  );
}

export function CohortSettingsForm({ cohortId, version, values, locked }: { cohortId: string; version: number; values: Values; locked: boolean }) {
  return (
    <ActionForm action={updateCohortSettingsAction} submitLabel="Save settings" successMessage="Settings saved." warnUnsaved>
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="version" value={String(version)} />
      <CommonFields v={values} />
      <ScheduleFields startDate={values.startDate} weekCount={values.weekCount} timezone={values.timezone} locked={locked} />
      <SupportField v={values} />
    </ActionForm>
  );
}
