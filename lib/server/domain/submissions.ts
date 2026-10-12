import "server-only";
import { z } from "zod";
import { siteConfig } from "@/content/site";
import { CONTRIBUTION_OPTIONS, STAGE_OPTIONS } from "@/lib/forms";
import { email as emailSchema, requiredText, text } from "@/lib/validation";
import { audit } from "../audit";
import { sql, tx } from "../db";
import { enqueueEmail } from "../email/outbox";
import { env } from "../env";
import { forbidden, notFound } from "../errors";
import { rateLimit } from "../rate-limit";
import type { Account } from "../session";
import { getOrganization } from "./organization";
import { parse } from "./validate";

const consent = z.literal(true, { error: "Please confirm you are happy to receive relevant updates." });
const base = {
  name: requiredText(120, "Name"),
  email: emailSchema,
  city: requiredText(120, "City"),
  consent,
  sourcePage: z.string().max(300).optional().default(""),
  website: z.string().optional().default(""), // honeypot
};
const contributionSchema = z.object({
  kind: z.literal("contribution"),
  ...base,
  contribution: z.enum(CONTRIBUTION_OPTIONS.map((o) => o.value) as [string, ...string[]], { error: "Please choose how you would like to contribute." }),
  expertise: text(200, "Area of expertise").default(""),
  organization: text(200, "Organization").default(""),
  details: text(3000, "Details").default(""),
});
const interestSchema = z.object({
  kind: z.literal("combinator_interest"),
  ...base,
  problem: requiredText(2000, "Problem"),
  stage: z.enum(STAGE_OPTIONS as unknown as [string, ...string[]], { error: "Please choose the closest option." }),
  evidence: text(2000, "Evidence").default(""),
});
const submissionSchema = z.discriminatedUnion("kind", [contributionSchema, interestSchema]);

export type Answer = { label: string; value: string };
export const answerOf = (answers: unknown, label: string) => (Array.isArray(answers) ? (answers as Answer[]).find((a) => a.label === label)?.value ?? "" : "");

export const KIND_LABEL: Record<string, string> = { contribution: "Get Involved", combinator_interest: "Combinator interest" };
export const STATUS_LABEL: Record<string, string> = { new: "New", contacted: "Contacted", done: "Done", archived: "Archived" };

const shortLabel = (contribution: string) => CONTRIBUTION_OPTIONS.find((o) => o.value === contribution)?.short ?? contribution;

/** The email subject the program inbox sees, so Gmail can be filtered and searched by type. */
export function inboxSubject(v: { kind: string; name: string; category: string; organization?: string }) {
  return v.kind === "contribution"
    ? `[Get Involved] ${v.category} — ${v.name}${v.organization ? ` (${v.organization})` : ""}`
    : `[Combinator Interest] ${v.name} — ${v.category}`;
}

/**
 * Store a public form submission and notify the program inbox. Anonymous and
 * rate limited; bot submissions (honeypot filled) are accepted silently and dropped.
 */
export async function submitPublicForm(input: Record<string, unknown>, ip: string) {
  await rateLimit(`public-form:ip:${ip}`, 10, 3600);
  const v = parse(submissionSchema, input);
  if (v.website) return { id: null };
  await rateLimit(`public-form:email:${v.email}`, 5, 3600);
  const category = v.kind === "contribution" ? shortLabel(v.contribution) : v.stage;
  // An ordered list: jsonb objects don't keep key order.
  const answers: Answer[] = (
    v.kind === "contribution"
      ? [["City", v.city], ["How they'd contribute", v.contribution], ["Organization", v.organization], ["Area of expertise", v.expertise], ["Details", v.details]]
      : [["City", v.city], ["Problem they care about", v.problem], ["Stage", v.stage], ["Evidence of action", v.evidence]]
  ).map(([label, value]) => ({ label, value }));
  return tx(async (t) => {
    const [row] = await t`
      insert into public_submissions (kind, category, name, email, answers, consent, source_page)
      values (${v.kind}, ${category}, ${v.name}, ${v.email}, ${t.json(answers)}, ${v.consent}, ${v.sourcePage.slice(0, 300)})
      returning id`;
    const org = await getOrganization(t);
    const lines = [`Name: ${v.name}`, `Email: ${v.email}`, ...answers.filter((a) => a.value).map((a) => `${a.label}: ${a.value}`), `Consent to updates: yes`, v.sourcePage ? `Submitted from: ${v.sourcePage}` : ""].filter(Boolean);
    await enqueueEmail(t, {
      eventType: "public_submission",
      template: "custom",
      to: siteConfig.contactEmail!,
      payload: {
        org: org?.name ?? siteConfig.officialName,
        support: null,
        // Replying in Gmail goes straight to the person who filled in the form.
        replyTo: v.email,
        subject: inboxSubject({ kind: v.kind, name: v.name, category, organization: v.kind === "contribution" ? v.organization : undefined }),
        body: `New ${KIND_LABEL[v.kind]} submission on the website.\n\n${lines.join("\n")}\n\nReply to this email to answer ${v.name} directly.`,
        buttonLabel: "Open in the admin inbox",
        url: `${env().APP_URL}/manage/submissions/${row.id}`,
      },
      related: { type: "public_submission", id: row.id },
      idempotencyKey: `public_submission:${row.id}`,
    });
    return { id: row.id as string };
  });
}

function requireOwner(actor: Account) {
  if (!actor.isOwner) throw forbidden("Only platform owners can see website submissions.");
}

export async function listSubmissions(actor: Account, f: { status?: string | null; kind?: string | null }) {
  requireOwner(actor);
  const status = f.status && f.status in STATUS_LABEL ? f.status : null;
  const kind = f.kind && f.kind in KIND_LABEL ? f.kind : null;
  const rows = await sql()`
    select s.id, s.kind, s.category, s.name, s.email, s.answers, s.status, s.created_at,
      (select o.state from email_outbox o where o.related_type = 'public_submission' and o.related_id = s.id limit 1) as email_state
    from public_submissions s
    where (${status}::text is null and s.status <> 'archived' or s.status = ${status})
      and (${kind}::text is null or s.kind = ${kind})
    order by s.created_at desc limit 300`;
  const counts = await sql()`select status, count(*)::int as n from public_submissions group by status`;
  return { rows, status, kind, counts: Object.fromEntries(counts.map((c) => [c.status as string, c.n as number])) as Record<string, number> };
}

export async function countNewSubmissions(actor: Account) {
  if (!actor.isOwner) return 0;
  const [r] = await sql()`select count(*)::int as n from public_submissions where status = 'new'`;
  return r.n as number;
}

export async function getSubmission(actor: Account, id: string) {
  requireOwner(actor);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("Submission not found.");
  const [s] = await sql()`
    select s.*, a.display_name as handled_by_name,
      (select o.id from email_outbox o where o.related_type = 'public_submission' and o.related_id = s.id limit 1) as email_id,
      (select o.state from email_outbox o where o.related_type = 'public_submission' and o.related_id = s.id limit 1) as email_state,
      (select o.last_error from email_outbox o where o.related_type = 'public_submission' and o.related_id = s.id limit 1) as email_error
    from public_submissions s left join accounts a on a.id = s.handled_by where s.id = ${id}`;
  if (!s) throw notFound("Submission not found.");
  return s;
}

const updateSchema = z.object({ status: z.enum(["new", "contacted", "done", "archived"]), note: text(4000, "Note").default("") });

export async function updateSubmission(actor: Account, id: string, input: Record<string, string>) {
  requireOwner(actor);
  const v = parse(updateSchema, input);
  await tx(async (t) => {
    const rows = await t`update public_submissions set status = ${v.status}, admin_note = ${v.note}, handled_by = ${actor.id}, handled_at = now()
                         where id = ${id} returning id`;
    if (!rows[0]) throw notFound("Submission not found.");
    await audit(t, { actorId: actor.id, action: "submission.update", objectType: "public_submission", objectId: id, summary: { status: v.status } });
  });
}
