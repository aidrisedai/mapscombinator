import type { Metadata } from "next";
import Link from "next/link";
import { OpForm } from "@/components/office-hours/OpForm";
import { SelectField, TextAreaField } from "@/components/ui/forms";
import { Badge, Card, KeyValue, PageHeader, Prose, SectionTitle, type BadgeTone } from "@/components/ui/primitives";
import { KIND_LABEL, STATUS_LABEL, answerOf, getSubmission, inboxSubject, type Answer } from "@/lib/server/domain/submissions";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";
import { updateSubmissionAction } from "../actions";

export const metadata: Metadata = { title: "Website submission" };

const TZ = "America/Los_Angeles";
const TONE: Record<string, BadgeTone> = { new: "warn", contacted: "info", done: "published", archived: "neutral" };
const EMAIL_STATE: Record<string, string> = {
  queued: "Queued",
  sending: "Sending",
  provider_accepted: "Sent to the program inbox",
  delivered: "Delivered to the program inbox",
  bounced: "Bounced",
  complained: "Marked as spam",
  failed: "Failed",
  suppressed: "Not sent (sandbox/test mode)",
};

export default async function SubmissionPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const account = await requirePageAccount(`/manage/submissions/${submissionId}`);
  const s = await load(() => getSubmission(account, submissionId));
  const answers = (Array.isArray(s.answers) ? s.answers : []) as Answer[];
  const subject = inboxSubject({ kind: s.kind, name: s.name, category: s.category, organization: answerOf(answers, "Organization") });
  const reply = `mailto:${s.email}?subject=${encodeURIComponent(`Re: ${s.kind === "contribution" ? `Your offer to MAPS Combinator (${s.category})` : "Your MAPS Combinator interest"}`)}&body=${encodeURIComponent(`Hi ${String(s.name).split(" ")[0]},\n\n`)}`;
  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link href="/manage/submissions" className="font-medium text-emerald hover:text-forest">← Website submissions</Link>
      </p>
      <PageHeader
        eyebrow={KIND_LABEL[s.kind]}
        title={s.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{s.category}</Badge>
            <Badge tone={TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
            <span className="text-sm text-ink/60">Received {formatInstant(s.created_at as Date, TZ)}</span>
          </span>
        }
        actions={<a href={reply} className="inline-flex items-center rounded-md bg-forest px-4 py-2 text-sm font-semibold text-paper hover:bg-emerald">Reply by email</a>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <SectionTitle>What they sent</SectionTitle>
          <KeyValue
            items={[
              ["Name", s.name],
              ["Email", <a key="e" href={`mailto:${s.email}`} className="break-all font-medium text-emerald hover:text-forest">{s.email}</a>],
              ...answers.filter((a) => a.value).map((a) => [a.label, <Prose key={a.label} text={a.value} />] as [string, React.ReactNode]),
              ["Consent to updates", s.consent ? "Yes" : "No"],
              ["Submitted from", s.source_page || null],
            ]}
          />
        </Card>
        <div className="space-y-6">
          <Card>
            <SectionTitle>Follow-up</SectionTitle>
            <OpForm action={updateSubmissionAction} submitLabel="Save" pendingLabel="Saving…" successMessage="Saved.">
              <input type="hidden" name="submissionId" value={s.id} />
              <SelectField label="Status" name="status" defaultValue={s.status} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
              <TextAreaField label="Internal note" name="note" defaultValue={s.admin_note} maxLength={4000} rows={4} optional hint="Only platform owners see this." />
            </OpForm>
            {s.handled_by_name && <p className="mt-3 text-xs text-ink/60">Last updated by {s.handled_by_name} {formatInstant(s.handled_at as Date, TZ)}.</p>}
          </Card>
          <Card>
            <SectionTitle>Email to the program inbox</SectionTitle>
            <p className="text-sm text-ink/80">Subject: <strong>{subject}</strong></p>
            <p className="mt-1 text-sm text-ink/70">Status: {s.email_state ? (EMAIL_STATE[s.email_state] ?? s.email_state) : "—"}</p>
            {s.email_error && <p className="mt-1 text-xs text-error">{s.email_error}</p>}
            <p className="mt-2 text-xs text-ink/60">Replying to that email in Gmail goes straight to {s.name}.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
