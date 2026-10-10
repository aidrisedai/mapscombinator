"use client";

import { useState, useTransition } from "react";
import { CheckboxField } from "@/components/ui/forms";
import { OpForm } from "@/components/office-hours/OpForm";
import { Badge, buttonClass, cx } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/forms";
import { addAdvisorsAction, addExistingAdvisorsAction, previewAdvisorsAction } from "./actions";

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
