export type SubmitResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Submits a public website form to the platform. It's stored for the admin
 * inbox (Manage → Website submissions) and emailed to the program address.
 */
export async function submitForm(kind: "contribution" | "combinator_interest", fields: Record<string, string | boolean>): Promise<SubmitResult> {
  try {
    const res = await fetch("/api/public/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...fields, sourcePage: typeof window !== "undefined" ? window.location.pathname : "" }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | null;
    if (res.ok && data?.ok) return { ok: true };
    return { ok: false, error: data?.error ?? "Something went wrong sending your response. Please try again.", fieldErrors: data?.fieldErrors };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Check your connection and try again — your answers are still here." };
  }
}
