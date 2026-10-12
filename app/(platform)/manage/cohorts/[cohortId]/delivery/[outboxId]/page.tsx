import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/ui/forms";
import { Badge, Card, KeyValue, Notice, PageHeader } from "@/components/ui/primitives";
import { requireCohortAdmin } from "@/lib/server/authz";
import { getCohortEmail } from "@/lib/server/domain/emails";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant } from "@/lib/time";
import { retryEmailAction } from "../../../../actions";

export const metadata: Metadata = { title: "Email" };

const STATE: Record<string, { label: string; tone: "draft" | "info" | "published" | "danger" | "warn" }> = {
  queued: { label: "Queued", tone: "draft" },
  sending: { label: "Sending", tone: "draft" },
  provider_accepted: { label: "Accepted by provider", tone: "info" },
  delivered: { label: "Delivered", tone: "published" },
  bounced: { label: "Bounced", tone: "danger" },
  complained: { label: "Marked as spam", tone: "danger" },
  failed: { label: "Failed", tone: "danger" },
  suppressed: { label: "Not sent", tone: "warn" },
};

export default async function EmailPage({ params }: { params: Promise<{ cohortId: string; outboxId: string }> }) {
  const { cohortId, outboxId } = await params;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/delivery/${outboxId}`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  const { email: m, rendered, hidesLink } = await load(() => getCohortEmail(account, cohort.id, outboxId));
  const tz = cohort.timezone;
  const s = STATE[m.state as string] ?? { label: m.state as string, tone: "draft" as const };
  const pending = m.state === "queued" || m.state === "sending";
  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link href={`/manage/cohorts/${cohort.id}/delivery`} className="font-medium text-emerald hover:text-forest">← Email delivery</Link>
      </p>
      <PageHeader title={rendered.subject || "(no subject)"} eyebrow="Email" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {pending && <Notice tone="info" title="Not sent yet">This is exactly what will be sent. Queued emails usually go out within a few seconds.</Notice>}
          {hidesLink && (
            <Notice tone="info" title="Private link or code hidden">The real email contains a single-use link or code for this person. It isn&apos;t shown here, for security.</Notice>
          )}
          <div className="overflow-hidden rounded-md border border-line">
            <div className="border-b border-line bg-cream/60 px-3 py-2 text-sm">
              <p><span className="text-ink/60">To: </span><span className="break-all">{m.recipient_email as string}</span></p>
              <p><span className="text-ink/60">Subject: </span><strong className="font-semibold">{rendered.subject}</strong></p>
            </div>
            <iframe title="Email content" sandbox="" srcDoc={rendered.html} className="h-[36rem] w-full bg-white" />
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-forest">Plain-text version</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-md border border-line bg-paper p-3 text-xs">{rendered.text}</pre>
          </details>
        </div>
        <Card className="self-start">
          <KeyValue
            items={[
              ["Status", <Badge key="s" tone={s.tone}>{s.label}</Badge>],
              ["Type", (m.event_type as string).replaceAll("_", " ")],
              ["Queued", formatInstant(m.created_at as Date, tz)],
              ["Last update", formatInstant(m.updated_at as Date, tz)],
              ["Attempts", String(m.attempts)],
              ...(m.authorized_by_name ? [["Sent by", m.authorized_by_name as string] as [string, string]] : []),
              ...(m.last_error ? [["Note", m.last_error as string] as [string, string]] : []),
            ]}
          />
          {m.state === "failed" && (
            <div className="mt-4">
              <ActionButton action={retryEmailAction} fields={{ cohortId: cohort.id, outboxId: m.id as string }} label="Retry" pendingLabel="Queuing…" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
