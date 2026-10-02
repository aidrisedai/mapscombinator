"use client";

import { ActionForm, TextAreaField } from "@/components/ui/forms";
import { transitionCohortAction } from "../actions";

type Option = { key: string; title: string; body: string; label: string; variant: "primary" | "secondary" | "danger"; confirm: string; reason?: boolean };

export function LifecycleActions({ cohortId, status, isOwner, hasAdmins }: { cohortId: string; status: string; isOwner: boolean; hasAdmins: boolean }) {
  const options: Option[] = [];
  if (status === "draft")
    options.push({
      key: "activate",
      title: "Activate the cohort",
      body: `Founders can start posting daily and weekly updates, and booking opens. Only weeks you publish appear as program work. No email is sent.${!hasAdmins && !isOwner ? " Assign a cohort administrator first." : ""}`,
      label: "Activate cohort",
      variant: "primary",
      confirm: "Activate this cohort? Founders will be able to post updates right away.",
    });
  if (status === "active")
    options.push({
      key: "complete",
      title: "Complete the cohort",
      body: "Completed cohorts are read-only for founders: they keep access to the journal and weekly guide but can no longer post. Nothing is deleted.",
      label: "Mark as completed",
      variant: "secondary",
      confirm: "Mark this cohort as completed? Founders will no longer be able to post updates.",
    });
  if (status === "completed" && isOwner) {
    options.push({
      key: "reopen",
      title: "Reopen the cohort",
      body: "Returns the cohort to active so founders can post again.",
      label: "Reopen cohort",
      variant: "secondary",
      confirm: "Reopen this cohort? Founders will be able to post updates again.",
    });
    options.push({
      key: "archive",
      title: "Archive the cohort",
      body: "Archived cohorts are read-only for everyone, including administrators, until a platform owner restores them. History is preserved; nothing is deleted.",
      label: "Archive cohort",
      variant: "danger",
      confirm: "Archive this cohort? It becomes read-only for everyone until restored.",
    });
  }
  if (status === "archived" && isOwner)
    options.push({
      key: "restore",
      title: "Restore the cohort",
      body: "Restores the cohort to completed so administrators can make changes again. The reason is kept in the audit log.",
      label: "Restore cohort",
      variant: "secondary",
      confirm: "Restore this cohort to completed?",
      reason: true,
    });

  if (options.length === 0)
    return <p className="text-sm text-ink/70">{status === "completed" ? "A platform owner can reopen or archive this cohort." : status === "archived" ? "A platform owner can restore this cohort." : "No lifecycle changes are available."}</p>;

  return (
    <div className="space-y-5">
      {options.map((o) => (
        <div key={o.key} className="border-t border-line/60 pt-4 first:border-t-0 first:pt-0">
          <p className="font-semibold text-ink">{o.title}</p>
          <p className="mt-1 text-sm text-ink/70">{o.body}</p>
          <ActionForm action={transitionCohortAction} submitLabel={o.label} pendingLabel="Updating…" submitVariant={o.variant} confirmMessage={o.confirm} className="mt-3">
            <input type="hidden" name="cohortId" value={cohortId} />
            <input type="hidden" name="transition" value={o.key} />
            {o.reason && <TextAreaField label="Reason for restoring" name="reason" required maxLength={500} rows={2} />}
          </ActionForm>
        </div>
      ))}
    </div>
  );
}
