"use client";

import { useState } from "react";
import { submitForm } from "@/lib/submit";
import { Field, Honeypot, inputClass } from "./forms/fields";

const STAGE_OPTIONS = [
  "Researching a problem",
  "Talking to potential users",
  "Building a prototype",
  "Have early users or customers",
  "Team formed, ready for a structured program",
];

type FormState = {
  name: string;
  email: string;
  city: string;
  problem: string;
  stage: string;
  evidence: string;
  consent: boolean;
};

const INITIAL: FormState = {
  name: "",
  email: "",
  city: "",
  problem: "",
  stage: "",
  evidence: "",
  consent: false,
};

/** Focused interest form for MAPS Combinator — basic fit and launch updates. */
export function CombinatorInterestForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success-endpoint" | "success-mailto" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Please enter a valid email address.";
    if (!form.city.trim()) next.city = "Please enter your city.";
    if (!form.problem.trim())
      next.problem = "Please describe the problem you care about.";
    if (!form.stage) next.stage = "Please choose the closest option.";
    if (!form.consent)
      next.consent = "Please confirm you are happy to receive program updates.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return;
    if (!validate()) return;
    setStatus("submitting");
    const result = await submitForm("MAPS Combinator interest", {
      name: form.name,
      email: form.email,
      city: form.city,
      problem: form.problem,
      stage: form.stage,
      evidenceOfAction: form.evidence,
      consentToUpdates: form.consent,
    });
    if (result.ok) {
      setStatus(result.mode === "endpoint" ? "success-endpoint" : "success-mailto");
    } else {
      setErrorMessage(result.error);
      setStatus("error");
    }
  }

  if (status === "success-endpoint" || status === "success-mailto") {
    return (
      <div className="rounded-lg border border-success/40 bg-paper p-8" role="status">
        <p className="font-display text-xl font-bold text-forest">
          {status === "success-endpoint"
            ? "You are on the Combinator interest list."
            : "One more step: send the email draft."}
        </p>
        <p className="mt-3 leading-relaxed text-ink/85">
          {status === "success-endpoint"
            ? "We will send program updates — including the application timeline — as details are confirmed."
            : "We opened a pre-filled email in your mail app with your answers. Press send and you are on the interest list — we will share the application timeline as details are confirmed."}
        </p>
        {status === "success-mailto" && (
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="mt-4 text-sm font-semibold text-emerald underline underline-offset-4"
          >
            Nothing opened? Go back and try again
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Honeypot value={honeypot} onChange={setHoneypot} />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Name" name="name" required error={errors.name}>
          <input
            id="name"
            className={inputClass}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
        </Field>
        <Field label="Email" name="email" required error={errors.email}>
          <input
            id="email"
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
        </Field>
      </div>

      <Field label="City" name="city" required error={errors.city}>
        <input
          id="city"
          className={inputClass}
          value={form.city}
          onChange={(e) => set("city", e.target.value)}
          autoComplete="address-level2"
          aria-invalid={!!errors.city}
          aria-describedby={errors.city ? "city-error" : undefined}
        />
      </Field>

      <Field
        label="What problem are you working on—or want to work on?"
        name="problem"
        required
        error={errors.problem}
      >
        <textarea
          id="problem"
          rows={4}
          className={inputClass}
          value={form.problem}
          onChange={(e) => set("problem", e.target.value)}
          aria-invalid={!!errors.problem}
          aria-describedby={errors.problem ? "problem-error" : undefined}
        />
      </Field>

      <Field
        label="Where are you today?"
        name="stage"
        required
        error={errors.stage}
      >
        <select
          id="stage"
          className={inputClass}
          value={form.stage}
          onChange={(e) => set("stage", e.target.value)}
          aria-invalid={!!errors.stage}
          aria-describedby={errors.stage ? "stage-error" : undefined}
        >
          <option value="">Choose one…</option>
          {STAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Evidence of action so far"
        name="evidence"
        optionalNote="optional — interviews, a prototype, early usage, preorders, research"
      >
        <textarea
          id="evidence"
          rows={3}
          className={inputClass}
          value={form.evidence}
          onChange={(e) => set("evidence", e.target.value)}
        />
      </Field>

      <Field label="" name="consent" error={errors.consent}>
        <label className="flex items-start gap-3 text-sm text-ink/85">
          <input
            id="consent"
            type="checkbox"
            className="mt-1 h-4 w-4 accent-emerald"
            checked={form.consent}
            onChange={(e) => set("consent", e.target.checked)}
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? "consent-error" : undefined}
          />
          <span>
            I consent to receive MAPS Combinator updates. Your information is
            used only to share program news and understand demand. No spam.
          </span>
        </label>
      </Field>

      {status === "error" && (
        <p className="text-sm text-error" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded-full bg-forest px-8 py-3.5 font-semibold text-paper transition-colors hover:bg-emerald disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Join the Combinator Interest List"}
      </button>
    </form>
  );
}
