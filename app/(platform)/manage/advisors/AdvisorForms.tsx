"use client";

import { useRef, useState, useTransition } from "react";
import { TextField } from "@/components/ui/forms";
import { Badge, buttonClass, cx } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/forms";
import { addAdvisorToCohortsAction, addAdvisorsAction, assignAdvisorAction, previewAdvisorForCohortsAction, previewAdvisorsAction } from "./actions";

type Plan = { line: number; name: string; email: string; error?: string; action: "invite" | "add_existing" | "already" | "pending" | "skip"; accountName?: string };

const LABEL: Record<Plan["action"], { text: string; tone: "published" | "info" | "neutral" | "warn" | "danger" }> = {
  invite: { text: "New: invitation to set up an account", tone: "published" },
  add_existing: { text: "Has an account: added directly", tone: "info" },
  already: { text: "Already an advisor here", tone: "neutral" },
  pending: { text: "Invitation already pending", tone: "neutral" },
  skip: { text: "Skipped", tone: "danger" },
};

export function InviteAdvisors({ cohortId }: { cohortId: string }) {
  const [list, setList] = useState("");
  const [plan, setPlan] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const doable = plan?.filter((p) => p.action === "invite" || p.action === "add_existing") ?? [];

  function run(kind: "preview" | "send") {
    const fd = new FormData();
    fd.set("cohortId", cohortId);
    fd.set("list", list);
    start(async () => {
      try {
        const r = kind === "preview" ? await previewAdvisorsAction(fd) : await addAdvisorsAction(fd);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setError(null);
        if (kind === "preview") {
          setPlan(r.data as Plan[]);
          setDone(null);
        } else {
          setDone((r.data as { message: string }).message);
          setPlan(null);
          setList("");
        }
      } catch {
        setError("We couldn't reach the server. Your list is still here; try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="advisor-list" className="block text-sm font-semibold text-ink">Advisors to add</label>
        <p id="advisor-list-hint" className="mt-0.5 text-xs text-ink/60">
          One per line: <code>Name, email</code>. You can paste rows from a spreadsheet. People who already have an account (for example from an earlier cohort) are added straight away and emailed; they don&apos;t sign up again.
        </p>
        <textarea
          id="advisor-list"
          name="list"
          rows={6}
          aria-describedby="advisor-list-hint"
          className={cx(inputClass, "mt-1.5 font-mono text-xs leading-relaxed")}
          placeholder={"Maya Chen, maya@example.org\nOmar Haddad <omar@example.org>"}
          value={list}
          onChange={(e) => {
            setList(e.target.value);
            setPlan(null);
          }}
        />
      </div>
      {error && <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{error}</p>}
      {done && <p role="status" className="rounded-md border border-emerald/40 bg-emerald/5 px-3 py-2 text-sm text-success">{done}</p>}
      {plan && (
        <div className="rounded-md border border-line">
          <p className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">Check before sending</p>
          <ul className="divide-y divide-line/60">
            {plan.map((p) => (
              <li key={p.line} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 break-all">
                  <strong className="font-medium">{p.accountName ?? (p.name || "(no name)")}</strong> <span className="text-ink/60">{p.email || `line ${p.line}`}</span>
                  {p.error && <span className="block text-xs text-error">{p.error}</span>}
                </span>
                <Badge tone={LABEL[p.action].tone}>{LABEL[p.action].text}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass(plan ? "secondary" : "primary")} disabled={pending || !list.trim()} onClick={() => run("preview")}>
          {pending && !plan ? "Checking…" : "Preview"}
        </button>
        {plan && (
          <button type="button" className={buttonClass("primary")} disabled={pending || doable.length === 0} onClick={() => run("send")}>
            {pending ? "Sending…" : doable.length === 0 ? "Nothing to send" : `Confirm: add ${doable.length} advisor${doable.length === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
    </div>
  );
}

type Cohort = { id: string; name: string };
type MultiPreview = {
  name: string;
  email: string;
  expertise: string[];
  linkedinUrl: string | null;
  cohorts: { cohortId: string; cohortName: string; action: Plan["action"]; error?: string; accountName?: string }[];
};

const ACTION_TEXT: Record<Plan["action"], string> = {
  invite: "New: gets an invitation",
  add_existing: "Has an account: added now",
  already: "Already an advisor here",
  pending: "Invitation already pending",
  skip: "Can't be added",
};

/** One advisor, one or more cohorts, with a check of what will happen before anything is sent. */
export function AddAdvisorForm({ cohorts, defaultCohortIds }: { cohorts: Cohort[]; defaultCohortIds: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<MultiPreview | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fd = () => new FormData(formRef.current!);
  const doable = preview?.cohorts.filter((c) => c.action === "invite" || c.action === "add_existing") ?? [];
  const run = (kind: "preview" | "send") =>
    start(async () => {
      try {
        const r = kind === "preview" ? await previewAdvisorForCohortsAction(fd()) : await addAdvisorToCohortsAction(fd());
        if (!r.ok) {
          setError(r.error);
          setErrors(r.fieldErrors ?? {});
          setPreview(null);
          return;
        }
        setError(null);
        setErrors({});
        if (kind === "preview") {
          setPreview(r.data as MultiPreview);
          setDone(null);
        } else {
          setDone((r.data as { message: string }).message);
          setPreview(null);
          formRef.current?.reset();
        }
      } catch {
        setError("We couldn't reach the server. Your details are still here; try again.");
      }
    });
  const isNew = preview?.cohorts.some((c) => c.action === "invite");
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        run(preview && doable.length ? "send" : "preview");
      }}
      onChange={() => {
        setPreview(null);
        setDone(null);
      }}
      className="space-y-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" name="name" required maxLength={120} autoComplete="off" error={errors.name} />
        <TextField label="Email" name="email" type="email" required autoComplete="off" error={errors.email} />
      </div>
      <TextField label="Areas of expertise" name="expertise" optional placeholder="e.g. Fundraising, B2B sales, Pricing" hint="Separate with commas. Pre-fills their profile; they can edit it." error={errors.expertise} />
      <TextField label="LinkedIn" name="linkedinUrl" optional placeholder="linkedin.com/in/their-name" error={errors.linkedinUrl} />
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Cohorts they advise <span className="text-error" aria-hidden="true">*</span></legend>
        <p className="mt-0.5 text-xs text-ink/60">They see these cohorts&apos; startups, progress and weekly materials, and founders there can see and book them.</p>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {cohorts.map((c) => (
            <label key={c.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="cohortId" value={c.id} defaultChecked={defaultCohortIds.includes(c.id)} className="mt-1 accent-forest" />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
        {errors.cohortIds && <p className="mt-1 text-sm text-error">{errors.cohortIds}</p>}
      </fieldset>
      {error && <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{error}</p>}
      {done && <p role="status" className="rounded-md border border-emerald/40 bg-emerald/5 px-3 py-2 text-sm text-success">{done}</p>}
      {preview && (
        <div className="rounded-md border border-forest/30 bg-forest/5 p-4 text-sm" role="status">
          <p className="flex flex-wrap items-center gap-2">
            <strong>{preview.cohorts[0]?.accountName ?? preview.name}</strong> <span className="break-all text-ink/60">{preview.email}</span>
          </p>
          <ul className="mt-2 space-y-1">
            {preview.cohorts.map((c) => (
              <li key={c.cohortId} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.cohortName}</span>
                <Badge tone={LABEL[c.action].tone}>{ACTION_TEXT[c.action]}</Badge>
                {c.error && <span className="text-xs text-error">{c.error}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-ink/80">
            {isNew
              ? "They get one invitation email, confirm their email with a code, set a password and complete their profile. They join every cohort above when they accept."
              : doable.length
                ? "They already have an account, so they're added straight away and get a short email. No new sign-up."
                : "Nothing to do for these cohorts."}
          </p>
          {(preview.expertise.length > 0 || preview.linkedinUrl) && (
            <p className="mt-1 text-xs text-ink/60">Profile pre-fill: {[preview.expertise.join(", "), preview.linkedinUrl].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {preview && doable.length ? (
          <>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>{pending ? "Sending…" : isNew ? "Send invitation" : "Add now"}</button>
            <button type="button" disabled={pending} className={buttonClass("secondary")} onClick={() => setPreview(null)}>Edit</button>
          </>
        ) : (
          <button type="submit" disabled={pending} className={buttonClass("primary")}>{pending ? "Checking…" : "Continue"}</button>
        )}
      </div>
    </form>
  );
}

/** Paste a list for one cohort. */
export function BulkAdvisors({ cohorts, defaultCohortId }: { cohorts: Cohort[]; defaultCohortId: string }) {
  const [cohortId, setCohortId] = useState(defaultCohortId);
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="bulk-cohort" className="block text-sm font-semibold text-ink">Cohort</label>
        <select id="bulk-cohort" value={cohortId} onChange={(e) => setCohortId(e.target.value)} className={cx(inputClass, "mt-1.5")}>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <InviteAdvisors key={cohortId} cohortId={cohortId} />
    </div>
  );
}

/** Add an existing advisor to another cohort. */
export function AssignToCohort({ accountId, options }: { accountId: string; options: Cohort[] }) {
  const [cohortId, setCohortId] = useState(options[0]?.id ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`assign-${accountId}`}>Add to cohort</label>
      <select id={`assign-${accountId}`} value={cohortId} onChange={(e) => setCohortId(e.target.value)} className="rounded-md border border-line bg-paper px-2 py-1.5 text-xs">
        {options.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        className={buttonClass("secondary", "sm")}
        onClick={() =>
          start(async () => {
            const f = new FormData();
            f.set("cohortId", cohortId);
            f.set("accountId", accountId);
            try {
              const r = await assignAdvisorAction(f);
              setMsg(r.ok ? { ok: true, text: (r.data as { message: string }).message } : { ok: false, text: r.error });
            } catch {
              setMsg({ ok: false, text: "Couldn't reach the server. Try again." });
            }
          })
        }
      >
        {pending ? "Adding…" : "Add to cohort"}
      </button>
      {msg && <span role={msg.ok ? "status" : "alert"} className={cx("text-xs", msg.ok ? "text-success" : "text-error")}>{msg.text}</span>}
    </div>
  );
}
