import { z } from "zod";

/** Optional HTTPS link: blank → null; rejects javascript:, data:, http:, credentials. */
export function safeHttpsUrl(value: unknown): { ok: true; url: string | null } | { ok: false } {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return { ok: true, url: null };
  if (s.length > 2000) return { ok: false };
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return { ok: false };
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false };
  }
}

export const optionalHttps = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const r = safeHttpsUrl(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: "Use a full https:// link." });
      return z.NEVER;
    }
    return r.url;
  });

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Enter a valid email address." }).max(254));

export const text = (max: number, label = "This field") =>
  z.string().trim().max(max, { message: `${label} must be ${max.toLocaleString()} characters or fewer.` });

export const requiredText = (max: number, label = "This field") =>
  text(max, label).min(1, { message: `${label} is required.` });

/** zod issues → { field: message } */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    out[k] ??= i.message;
  }
  return out;
}

export function formObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) o[k] = v;
  return o;
}
