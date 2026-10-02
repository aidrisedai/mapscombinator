"use client";

import { OpForm } from "@/components/office-hours/OpForm";
import { CheckboxField, TextAreaField } from "@/components/ui/forms";
import { cancelSessionAction, publishSessionsAction, updateSessionAction } from "../actions";
import { SessionFields, type HostOption, type SessionDefaults, type WeekOption } from "../SessionFields";

function ScopeChoice({ name = "scope", options }: { name?: string; options: { value: string; label: string; hint?: string }[] }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">Apply to</legend>
      <div className="mt-2 space-y-2 text-sm">
        {options.map((o, i) => (
          <label key={o.value} className="flex items-start gap-2">
            <input type="radio" name={name} value={o.value} defaultChecked={i === 0} className="mt-1 accent-forest" />
            <span>
              <span className="font-medium">{o.label}</span>
              {o.hint && <span className="block text-xs text-ink/60">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

export function EditSessionForm({
  cohortId,
  sessionId,
  hosts,
  weeks,
  timezone,
  defaults,
  inSeries,
  published,
  previouslyEmailed,
  recipients,
}: {
  cohortId: string;
  sessionId: string;
  hosts: HostOption[];
  weeks: WeekOption[];
  timezone: string;
  defaults: SessionDefaults;
  inSeries: boolean;
  published: boolean;
  previouslyEmailed: boolean;
  recipients: number;
}) {
  return (
    <OpForm
      action={updateSessionAction}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      warnUnsaved
      confirmIfChecked={{ name: "sendEmail", message: `Save and email the change to ${people(recipients)}? One email each; this can't be unsent.` }}
    >
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <SessionFields hosts={hosts} weeks={weeks} timezone={timezone} defaults={defaults} />
      {inSeries && (
        <ScopeChoice
          options={[
            { value: "this", label: "This occurrence" },
            { value: "future", label: "This and future occurrences", hint: "Earlier occurrences are never changed. A new time applies to each occurrence's own date." },
          ]}
        />
      )}
      {published && (
        <CheckboxField
          name="sendEmail"
          label={`Send change email to ${people(recipients)}`}
          defaultChecked={previouslyEmailed}
          hint={previouslyEmailed ? "Checked because this session was emailed before." : "This session hasn't been emailed before."}
        />
      )}
    </OpForm>
  );
}

export function PublishSessionForm({ cohortId, sessionId, thisIsDraft, seriesDrafts, recipients }: { cohortId: string; sessionId: string; thisIsDraft: boolean; seriesDrafts: number; recipients: number }) {
  const options = [
    ...(thisIsDraft ? [{ value: "this", label: "This occurrence" }] : []),
    ...(seriesDrafts > 0 ? [{ value: "series", label: `All remaining drafts in the series (${seriesDrafts})` }] : []),
  ];
  return (
    <OpForm
      action={publishSessionsAction}
      submitLabel="Publish"
      pendingLabel="Publishing…"
      confirmIfChecked={{ name: "sendEmail", message: `Publish and email ${people(recipients)}? One email each; this can't be unsent.` }}
    >
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      {options.length > 1 ? <ScopeChoice options={options} /> : <input type="hidden" name="scope" value={options[0]?.value ?? "this"} />}
      <CheckboxField
        name="sendEmail"
        label={`Send announcement email to ${people(recipients)}`}
        hint="Active founders, mentors, viewers and administrators of this cohort — one message each, never CC'd. Includes title, host, date, time, timezone, where to join and how to prepare."
      />
    </OpForm>
  );
}

export function CancelSessionForm({ cohortId, sessionId, inSeries, published, previouslyEmailed, recipients }: { cohortId: string; sessionId: string; inSeries: boolean; published: boolean; previouslyEmailed: boolean; recipients: number }) {
  return (
    <OpForm
      action={cancelSessionAction}
      submitLabel="Cancel session"
      pendingLabel="Cancelling…"
      submitVariant="danger"
      confirmMessage="Cancel this session? It stays visible to founders as cancelled, with your reason."
      confirmIfChecked={{ name: "sendEmail", message: `Cancel and email ${people(recipients)}? One email each; this can't be unsent.` }}
    >
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <TextAreaField label="Reason" name="reason" required maxLength={500} rows={2} hint="Shown to founders next to the cancelled session and in the email." />
      {inSeries && (
        <ScopeChoice
          options={[
            { value: "this", label: "This occurrence" },
            { value: "future", label: "This and future occurrences" },
          ]}
        />
      )}
      {published && (
        <CheckboxField
          name="sendEmail"
          label={`Send cancellation email to ${people(recipients)}`}
          defaultChecked={previouslyEmailed}
          hint={previouslyEmailed ? "Checked because this session was emailed before." : "This session hasn't been emailed before."}
        />
      )}
    </OpForm>
  );
}
