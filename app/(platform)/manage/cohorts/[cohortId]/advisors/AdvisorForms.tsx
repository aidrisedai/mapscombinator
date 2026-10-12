"use client";

import { useRef, useState, useTransition } from "react";
import { CheckboxField, TextField } from "@/components/ui/forms";
import { OpForm } from "@/components/office-hours/OpForm";
import { Badge, buttonClass, cx } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/forms";
import { addAdvisorsAction, addExistingAdvisorsAction, addOneAdvisorAction, previewAdvisorsAction, previewOneAdvisorAction } from "./actions";

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

export function AddExistingAdvisors({ cohortId, people }: { cohortId: string; people: { id: string; name: string; email: string; headline: string | null; cohorts: string[] }[] }) {
  return (
    <OpForm action={addExistingAdvisorsAction} submitLabel="Add selected to this cohort" pendingLabel="Adding…" successMessage="Added.">
      <input type="hidden" name="cohortId" value={cohortId} />
      <div className="space-y-3">
        {people.map((p) => (
          <CheckboxField
            key={p.id}
            name="accountId"
            value={p.id}
            label={
              <>
                {p.name} <span className="text-ink/60">{p.email}</span>
              </>
            }
            hint={[p.headline, `Advises: ${p.cohorts.join(", ")}`].filter(Boolean).join(" · ")}
          />
        ))}
      </div>
    </OpForm>
  );
}

type OnePreview = Plan & { expertise: string[]; linkedinUrl: string | null };

/** The simple form: one advisor at a time, with a check of what will happen before anything is sent. */
export function AddAdvisorForm({ cohortId, cohortName }: { cohortId: string; cohortName: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<OnePreview | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fd = () => {
    const f = new FormData(formRef.current!);
    f.set("cohortId", cohortId);
    return f;
  };
  const run = (kind: "preview" | "send") =>
    start(async () => {
      try {
        const r = kind === "preview" ? await previewOneAdvisorAction(fd()) : await addOneAdvisorAction(fd());
        if (!r.ok) {
          setError(r.error);
          setErrors(r.fieldErrors ?? {});
          setPreview(null);
          return;
        }
        setError(null);
        setErrors({});
        if (kind === "preview") {
          setPreview(r.data as OnePreview);
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

  const confirmLabel = preview?.action === "invite" ? "Send invitation" : preview?.action === "add_existing" ? "Add to cohort now" : null;
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        run(preview && confirmLabel ? "send" : "preview");
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
      {error && <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{error}</p>}
      {done && <p role="status" className="rounded-md border border-emerald/40 bg-emerald/5 px-3 py-2 text-sm text-success">{done}</p>}
      {preview && (
        <div className="rounded-md border border-forest/30 bg-forest/5 p-4 text-sm" role="status">
          <p className="flex flex-wrap items-center gap-2">
            <strong>{preview.accountName ?? preview.name}</strong> <span className="break-all text-ink/60">{preview.email}</span>
            <Badge tone={LABEL[preview.action].tone}>{LABEL[preview.action].text}</Badge>
          </p>
          <p className="mt-2 text-ink/80">
            {preview.action === "invite" && `They'll get the advisor invitation email for ${cohortName}. They confirm their email with a code, set a password, then complete their profile.`}
            {preview.action === "add_existing" && `They already have an account, so they're added to ${cohortName} immediately and get a short email. No new sign-up.`}
            {preview.action === "already" && "They're already an advisor in this cohort. Nothing to do."}
            {preview.action === "pending" && "They already have a pending invitation. Use Resend under “Pending advisor invitations” instead."}
            {preview.action === "skip" && (preview.error ?? "This person can't be added.")}
          </p>
          {(preview.expertise.length > 0 || preview.linkedinUrl) && (
            <p className="mt-1 text-xs text-ink/60">
              Profile pre-fill: {[preview.expertise.join(", "), preview.linkedinUrl].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {preview && confirmLabel ? (
          <>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>{pending ? "Sending…" : confirmLabel}</button>
            <button type="button" disabled={pending} className={buttonClass("secondary")} onClick={() => setPreview(null)}>Edit</button>
          </>
        ) : (
          <button type="submit" disabled={pending} className={buttonClass("primary")}>{pending ? "Checking…" : "Continue"}</button>
        )}
      </div>
    </form>
  );
}
