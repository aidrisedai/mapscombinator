/** Placeholders admins can use in custom emails. Values are plain text; HTML escaping happens when the email is rendered. */
export const PLACEHOLDERS = {
  first_name: "Recipient's first name (\"there\" if unknown)",
  full_name: "Recipient's full name",
  startup_name: "Their startup",
  cohort_name: "Cohort name",
  start_date: "Program start date",
  program_name: "Organization name",
  inviter_name: "Who invited them / who is sending",
  support_email: "Program support email",
} as const;
export type PlaceholderKey = keyof typeof PLACEHOLDERS;
export type MergeVars = Partial<Record<PlaceholderKey, string | null | undefined>>;

const TOKEN = /\{\s*([a-z_]+)\s*\}/g;

/** Unknown placeholders, e.g. a typo like {frist_name}. */
export function unknownPlaceholders(text: string): string[] {
  const bad = new Set<string>();
  for (const m of text.matchAll(TOKEN)) if (!(m[1] in PLACEHOLDERS)) bad.add(m[1]);
  return [...bad];
}

export function merge(text: string, vars: MergeVars): string {
  return text.replace(TOKEN, (whole, key: string) => {
    if (!(key in PLACEHOLDERS)) return whole;
    const v = (vars[key as PlaceholderKey] ?? "").trim();
    if (key === "first_name") return v || (vars.full_name ?? "").trim().split(/\s+/)[0] || "there";
    return v;
  });
}

export const firstName = (full: string | null | undefined) => (full ?? "").trim().split(/\s+/)[0] ?? "";
