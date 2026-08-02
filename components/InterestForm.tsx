"use client";

import { useState } from "react";
import { submitForm } from "@/lib/submit";
import { Field, Honeypot, inputClass } from "./forms/fields";

const RELATIONSHIP_OPTIONS = [
  "I am building now",
  "I want to begin within 90 days",
  "I can mentor or offer expertise",
  "I represent an institution or potential partner",
  "I want to volunteer",
  "I want event updates",
];

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  relationship: string;
  building: string;
  nextResource: string;
  consent: boolean;
  phone: string;
  linkedin: string;
  skills: string;
  availability: string;
  contribution: string;
};

const INITIAL: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  city: "",
  relationship: "",
  building: "",
  nextResource: "",
  consent: false,
  phone: "",
  linkedin: "",
  skills: "",
  availability: "",
  contribution: "",
};

/** The founding community form. Does not request religious practice details,
 * immigration status, financial information, or other sensitive data. */
export function InterestForm() {
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
    if (!form.firstName.trim()) next.firstName = "Please enter your first name.";
    if (!form.lastName.trim()) next.lastName = "Please enter your last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Please enter a valid email address.";
    if (!form.city.trim()) next.city = "Please enter your city.";
    if (!form.relationship)
      next.relationship = "Please choose the option that fits you best.";
    if (!form.building.trim())
      next.building = "Please share a sentence or two.";
    if (!form.nextResource.trim())
      next.nextResource = "Please share what would help you most.";
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
    const result = await submitForm("Founding community interest", {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      city: form.city,
      relationship: form.relationship,
      whatAreYouBuilding: form.building,
      mostUsefulNextConnection: form.nextResource,
      consentToUpdates: form.consent,
      phone: form.phone,
      linkedinOrPortfolio: form.linkedin,
      skills: form.skills,
      availability: form.availability,
      howCouldYouContribute: form.contribution,
    });
    if (result.ok) {
      setStatus(result.mode === "endpoint" ? "success-endpoint" : "success-mailto");
    } else {
      setErrorMessage(result.error);
      setStatus("error");
    }
  }

  if (status === "success-endpoint") {
    return (
      <div className="rounded-lg border border-success/40 bg-cream p-8" role="status">
        <p className="font-display text-xl font-bold text-forest">
          You are on the founding community list.
        </p>
        <p className="mt-3 leading-relaxed text-ink/85">
          We will review what you shared and send relevant launch updates,
          events, or contribution opportunities as they are confirmed.
        </p>
      </div>
    );
  }

  if (status === "success-mailto") {
    return (
      <div className="rounded-lg border border-success/40 bg-cream p-8" role="status">
        <p className="font-display text-xl font-bold text-forest">
          One more step: send the email draft.
        </p>
        <p className="mt-3 leading-relaxed text-ink/85">
          We opened a pre-filled email in your mail app with your answers.
          Press send and you are on the founding community list — we will send
          relevant launch updates, events, or contribution opportunities as
          they are confirmed.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-semibold text-emerald underline underline-offset-4"
        >
          Nothing opened? Go back and try again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Honeypot value={honeypot} onChange={setHoneypot} />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="First name" name="firstName" required error={errors.firstName}>
          <input
            id="firstName"
            className={inputClass}
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            autoComplete="given-name"
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
          />
        </Field>
        <Field label="Last name" name="lastName" required error={errors.lastName}>
          <input
            id="lastName"
            className={inputClass}
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            autoComplete="family-name"
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "lastName-error" : undefined}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
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
      </div>

      <Field
        label="Primary relationship to building"
        name="relationship"
        required
        error={errors.relationship}
      >
        <select
          id="relationship"
          className={inputClass}
          value={form.relationship}
          onChange={(e) => set("relationship", e.target.value)}
          aria-invalid={!!errors.relationship}
          aria-describedby={errors.relationship ? "relationship-error" : undefined}
        >
          <option value="">Choose one…</option>
          {RELATIONSHIP_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="What are you building—or what should be built?"
        name="building"
        required
        error={errors.building}
      >
        <textarea
          id="building"
          rows={4}
          className={inputClass}
          value={form.building}
          onChange={(e) => set("building", e.target.value)}
          aria-invalid={!!errors.building}
          aria-describedby={errors.building ? "building-error" : undefined}
        />
      </Field>

      <Field
        label="What is the most useful next connection or resource for you?"
        name="nextResource"
        required
        error={errors.nextResource}
      >
        <textarea
          id="nextResource"
          rows={3}
          className={inputClass}
          value={form.nextResource}
          onChange={(e) => set("nextResource", e.target.value)}
          aria-invalid={!!errors.nextResource}
          aria-describedby={errors.nextResource ? "nextResource-error" : undefined}
        />
      </Field>

      <details className="rounded-md border border-line bg-cream/40 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-forest">
          Optional details — skills, availability, links
        </summary>
        <div className="mt-4 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Phone" name="phone" optionalNote="optional">
              <input
                id="phone"
                type="tel"
                className={inputClass}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                autoComplete="tel"
              />
            </Field>
            <Field
              label="LinkedIn or portfolio"
              name="linkedin"
              optionalNote="optional"
            >
              <input
                id="linkedin"
                type="url"
                className={inputClass}
                value={form.linkedin}
                onChange={(e) => set("linkedin", e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Skills or domain expertise"
            name="skills"
            optionalNote="optional"
          >
            <input
              id="skills"
              className={inputClass}
              value={form.skills}
              onChange={(e) => set("skills", e.target.value)}
            />
          </Field>
          <Field label="Availability" name="availability" optionalNote="optional">
            <input
              id="availability"
              className={inputClass}
              value={form.availability}
              onChange={(e) => set("availability", e.target.value)}
            />
          </Field>
          <Field
            label="How could you contribute to another builder?"
            name="contribution"
            optionalNote="optional"
          >
            <textarea
              id="contribution"
              rows={3}
              className={inputClass}
              value={form.contribution}
              onChange={(e) => set("contribution", e.target.value)}
            />
          </Field>
        </div>
      </details>

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
            I consent to receive relevant updates from the MAPS Center. We will
            use your information only to understand the community and share
            relevant updates. No spam. No public directory listing without
            separate consent.
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
        {status === "submitting" ? "Sending…" : "Join the Founding Community"}
      </button>
    </form>
  );
}
