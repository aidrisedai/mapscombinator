"use client";

import { OpForm } from "@/components/office-hours/OpForm";
import { ActionButton, CheckboxField } from "@/components/ui/forms";
import { publishAnnouncementAction, unpublishAnnouncementAction } from "../actions";

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

export function PublishAnnouncementForm({ cohortId, announcementId, recipients }: { cohortId: string; announcementId: string; recipients: number }) {
  return (
    <OpForm
      action={publishAnnouncementAction}
      submitLabel="Publish"
      pendingLabel="Publishing…"
      confirmIfChecked={{ name: "sendEmail", message: `Publish and email a copy to ${people(recipients)}? One email each; this can't be unsent.` }}
    >
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="announcementId" value={announcementId} />
      <CheckboxField
        name="sendEmail"
        label={`Send email copy to ${people(recipients)}`}
        hint="Active founders, mentors, viewers and administrators of this cohort, resolved now — one message each, never CC'd."
      />
    </OpForm>
  );
}

export function EmailCopyForm({ cohortId, announcementId, recipients }: { cohortId: string; announcementId: string; recipients: number }) {
  return (
    <OpForm
      action={publishAnnouncementAction}
      submitLabel={`Email a copy to ${people(recipients)}`}
      pendingLabel="Queuing…"
      submitVariant="secondary"
      confirmMessage={`Email this announcement to ${people(recipients)}? People who already received this version won't get it twice.`}
    >
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="announcementId" value={announcementId} />
      <input type="hidden" name="sendEmail" value="on" />
      <input type="hidden" name="wasPublished" value="1" />
    </OpForm>
  );
}

export function UnpublishButton({ cohortId, announcementId }: { cohortId: string; announcementId: string }) {
  return (
    <ActionButton
      action={unpublishAnnouncementAction}
      fields={{ cohortId, announcementId }}
      label="Unpublish"
      pendingLabel="Unpublishing…"
      variant="danger"
      confirmMessage="Unpublish this announcement? Members stop seeing it; emails already queued are not recalled."
    />
  );
}
