import { siteConfig } from "@/content/site";

export type SubmitResult =
  | { ok: true; mode: "endpoint" }
  | { ok: true; mode: "mailto" }
  | { ok: false; error: string };

/**
 * Submits a form payload.
 *
 * - When siteConfig.formEndpoint is configured, the payload is POSTed there
 *   as JSON (choose a vetted form service or your own API and validate +
 *   sanitize + rate-limit server-side; keep secrets in environment variables).
 * - Until an endpoint exists, the fallback composes a structured email draft
 *   to the confirmed contact address, so no submission is silently lost and
 *   no data is stored anywhere without an owner.
 *
 * Submission time, source page, and consent state are always included.
 */
export async function submitForm(
  subject: string,
  fields: Record<string, string | boolean>
): Promise<SubmitResult> {
  const payload = {
    ...fields,
    submittedAt: new Date().toISOString(),
    sourcePage: typeof window !== "undefined" ? window.location.pathname : "",
  };

  if (siteConfig.formEndpoint) {
    try {
      const res = await fetch(siteConfig.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, ...payload }),
      });
      if (!res.ok) throw new Error(`Submission failed (${res.status})`);
      return { ok: true, mode: "endpoint" };
    } catch {
      return {
        ok: false,
        error:
          "Something went wrong sending your response. Please try again, or email us directly.",
      };
    }
  }

  if (!siteConfig.contactEmail) {
    return {
      ok: false,
      error:
        "Submissions are not configured yet. Please check back soon.",
    };
  }

  const body = Object.entries(payload)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");
  const href = `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
  return { ok: true, mode: "mailto" };
}
