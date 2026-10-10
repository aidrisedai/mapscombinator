import type { Metadata } from "next";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { Badge, Card, Notice, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { aiConfigured } from "@/lib/server/ai/assistant";
import { requireCohortAdmin } from "@/lib/server/authz";
import { sql } from "@/lib/server/db";
import { PLACEHOLDERS } from "@/lib/server/email/merge";
import { audienceLabel, listAutoTemplates, listMessages, listSavedTemplates } from "@/lib/server/domain/emails";
import { load } from "@/lib/server/page";
import { requirePageAccount } from "@/lib/server/session";
import { formatInstant, todayIn, weekNumberFor } from "@/lib/time";
import { DeleteSavedTemplate, MessageComposer, TemplateEditor } from "./EmailForms";

export const metadata: Metadata = { title: "Emails" };

const STATE_LABEL: Record<string, string> = {
  queued: "queued",
  sending: "sending",
  provider_accepted: "sent",
  delivered: "delivered",
  bounced: "bounced",
  complained: "marked as spam",
  failed: "failed",
  suppressed: "not sent",
};

export default async function EmailsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const account = await requirePageAccount(`/manage/cohorts/${cohortId}/emails`);
  const { cohort } = await load(() => requireCohortAdmin(account, cohortId));
  const writable = cohort.status !== "archived";
  const [autos, saved, messages, startups, [mentors]] = await Promise.all([
    listAutoTemplates(account, cohort.id),
    listSavedTemplates(account, cohort.id),
    listMessages(account, cohort.id),
    sql()`select e.id, s.name, exists (select 1 from startup_memberships m join accounts a on a.id = m.account_id and a.state = 'active'
                                        where m.enrollment_id = e.id and m.active) as has_founders
          from enrollments e join startups s on s.id = e.startup_id where e.cohort_id = ${cohort.id} and e.status = 'active' order by s.name`,
    sql()`select count(*)::int as n from cohort_roles where cohort_id = ${cohort.id} and role = 'mentor' and active`,
  ]);
  const week = weekNumberFor(cohort.startDate, cohort.weekCount, todayIn(cohort.timezone));
  const placeholders = (
    <div className="rounded-md border border-line/70 bg-cream/40 px-4 py-3 text-xs text-ink/70">
      <p className="mb-1.5 font-semibold text-ink">Placeholders</p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {Object.entries(PLACEHOLDERS).map(([k, v]) => (
          <li key={k}>
            <code className="rounded bg-paper px-1 font-semibold text-forest">{`{${k}}`}</code> {v}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-10">
      <PageHeader title="Emails" description="Send personal emails to your startups and edit the automatic acceptance and welcome emails. Every message goes to each person separately, with the program support email as reply-to." />

      <section aria-labelledby="send-h" className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <SectionTitle>
            <span id="send-h">Email startups</span>
          </SectionTitle>
          {writable ? (
            <>
              <AiAssistant kind="email" ctx={{ cohortId: cohort.id }} target="#ai-target-message" configured={aiConfigured()} title="Write this email with AI" intro="Tell me what the email is about. I'll draft a subject and message using placeholders like {first_name} and {startup_name}." placeholder="e.g. Remind teams that demo day rehearsals are next Tuesday at 5pm; ask them to bring a 3-minute deck" />
              <div id="ai-target-message">
                <MessageComposer
                  cohortId={cohort.id}
                  startups={startups.map((s) => ({ id: s.id as string, name: s.name as string, hasFounders: s.has_founders as boolean }))}
                  saved={saved.map((t) => ({ id: t.id as string, name: t.name as string, subject: t.subject as string, body: t.body as string }))}
                  week={week}
                  mentorCount={mentors.n as number}
                />
              </div>
            </>
          ) : (
            <Notice tone="info" title="Read-only">This cohort is archived, so new emails can&apos;t be sent.</Notice>
          )}
        </Card>
        <div className="space-y-6">
          {placeholders}
          <Card>
            <SectionTitle>Sent emails</SectionTitle>
            {messages.length === 0 ? (
              <p className="text-sm text-ink/60">Nothing sent from here yet.</p>
            ) : (
              <ul className="divide-y divide-line/60">
                {messages.map((m) => {
                  const states = m.states as Record<string, number>;
                  return (
                    <li key={m.id as string} className="space-y-1 py-3 first:pt-0">
                      <p className="font-medium text-ink">{m.subject as string}</p>
                      <p className="text-xs text-ink/60">
                        {formatInstant(m.created_at as Date, cohort.timezone)} · {m.sender as string} · {audienceLabel(m.audience as string)}
                        {m.include_mentors ? " + mentors" : ""} · {m.recipient_count as number} recipient{m.recipient_count === 1 ? "" : "s"}
                      </p>
                      <p className="flex flex-wrap gap-1.5">
                        {Object.entries(states).map(([s, n]) => (
                          <Badge key={s} tone={s === "failed" || s === "bounced" || s === "complained" ? "danger" : s === "delivered" || s === "provider_accepted" ? "published" : "neutral"}>
                            {n} {STATE_LABEL[s] ?? s}
                          </Badge>
                        ))}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink/60">Details per person, including failures and retries, are under Delivery.</p>
          </Card>
          {saved.length > 0 && (
            <Card>
              <SectionTitle>Saved templates</SectionTitle>
              <ul className="divide-y divide-line/60">
                {saved.map((t) => (
                  <li key={t.id as string} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                    <span className="min-w-0 text-sm">
                      <span className="font-medium">{t.name as string}</span>
                      <span className="block truncate text-xs text-ink/60">{t.subject as string}</span>
                    </span>
                    {writable && <DeleteSavedTemplate cohortId={cohort.id} id={t.id as string} name={t.name as string} />}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </section>

      <section aria-labelledby="auto-h" className="space-y-4">
        <div>
          <h2 id="auto-h" className="font-display text-2xl font-bold text-forest">Automatic emails</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink/70">
            These go out on their own. The acceptance email is also the invitation: it includes the button to set up an account, so founders know what to do next. Edit the wording for this cohort, or leave the standard text.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {autos.map((t) => (
            <Card key={t.kind}>
              <SectionTitle action={t.current.custom ? <Badge tone="published">Customized</Badge> : <Badge tone="neutral">Standard wording</Badge>}>{t.title}</SectionTitle>
              <p className="mb-1 text-sm text-ink/70">{t.when}</p>
              <p className="mb-4 text-xs text-ink/60">{t.added}</p>
              <AiAssistant kind="email" ctx={{ cohortId: cohort.id }} target={`#ai-target-${t.kind}`} configured={aiConfigured()} title="Rewrite with AI" intro="Describe the tone or what to include. I'll draft the subject and message with placeholders." placeholder="e.g. Warmer, mention demo day on Dec 12 and our Slack channel" />
              <div id={`ai-target-${t.kind}`}>
                <TemplateEditor cohortId={cohort.id} kind={t.kind} subject={t.current.subject} body={t.current.body} custom={t.current.custom} writable={writable} />
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
