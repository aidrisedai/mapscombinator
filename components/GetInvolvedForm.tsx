"use client";

import { useState } from "react";
import { submitForm } from "@/lib/submit";
import { Field, Honeypot, inputClass } from "./forms/fields";

const CONTRIBUTION_OPTIONS = [
  "Mentor or hold office hours",
  "Be a customer or pilot partner",
  "Volunteer with program operations",
  "Sponsor or partner",
  "Just send me program updates",
];

type FormState = {
  name: string;
  email: string;
  city: string;
  contribution: string;
  expertise: string;
  organization: string;
  details: string;
  consent: boolean;
};

const INITIAL: FormState = {
  name: "",
  email: "",
  city: "",
  contribution: "",
  expertise: "",
  organization: "",
  details: "",
  consent: false,
};

/** Focused form for mentors, pilot partners, volunteers, and sponsors.
 * Does not request sensitive personal data. */
export function GetInvolvedForm() {
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
    if (!form.contribution)
      next.contribution = "Please choose how you would like to contribute.";
    if (!form.consent)
      next.consent = "Please confirm you are happy to receive relevant updates.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return; // silently drop bot submissions
    if (!validate()) return;
    setStatus("submitting");
    const result = await submitForm("MAPS Combinator contribution interest", {
      name: form.name,
      email: form.email,
      city: form.city,
      contribution: form.contribution,
      expertise: form.expertise,
      organization: form.organization,
      details: form.details,
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
      <div className="rounded-lg border border-success/40 bg-cream p-8" role="status">
        <p className="font-display text-xl font-bold text-forest">
          {status === "success-endpoint"
            ? "Thank you — we have your details."
            : "One more step: send the email draft."}
        </p>
        <p className="mt-3 leading-relaxed text-ink/85">
          {status === "success-endpoint"
            ? "We will follow up about the contribution you offered as the matching program pieces are confirmed."
            : "We opened a pre-filled email in your mail app with your answers. Press send and we will follow up about the contribution you offered as the matching program pieces are confirmed."}
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
        label="How would you like to contribute?"
        name="contribution"
        required
        error={errors.contribution}
      >
        <select
          id="contribution"
          className={inputClass}
          value={form.contribution}
          onChange={(e) => set("contribution", e.target.value)}
          aria-invalid={!!errors.contribution}
          aria-describedby={errors.contribution ? "contribution-error" : undefined}
        >
          <option value="">Choose one…</option>
          {CONTRIBUTION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Area of expertise"
          name="expertise"
          optionalNote="optional"
        >
          <input
            id="expertise"
            className={inputClass}
            value={form.expertise}
            onChange={(e) => set("expertise", e.target.value)}
          />
        </Field>
        <Field
          label="Organization"
          name="organization"
          optionalNote="optional"
        >
          <input
            id="organization"
            className={inputClass}
            value={form.organization}
            onChange={(e) => set("organization", e.target.value)}
            autoComplete="organization"
          />
        </Field>
      </div>

      <Field
        label="Anything else we should know?"
        name="details"
        optionalNote="optional — availability, the problem you could offer teams, what you would sponsor"
      >
        <textarea
          id="details"
          rows={3}
          className={inputClass}
          value={form.details}
          onChange={(e) => set("details", e.target.value)}
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
            I consent to receive relevant MAPS Combinator updates. Your
            information is used only to coordinate contributions and share
            program news. No spam.
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
        {status === "submitting" ? "Sending…" : "Offer to Contribute"}
      </button>
    </form>
  );
}
