/**
 * Transactional email templates. Every template returns subject + text +
 * escaped HTML. No passwords or private startup updates are ever included.
 */
export type Rendered = { subject: string; text: string; html: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

type Block = { p?: string; kv?: [string, string | null | undefined][]; button?: { label: string; url: string }; small?: string };

function compose(subject: string, org: string, blocks: Block[], support?: string | null): Rendered {
  const text: string[] = [];
  const html: string[] = [];
  for (const b of blocks) {
    if (b.p) {
      text.push(b.p);
      html.push(`<p style="margin:0 0 16px;line-height:1.5">${esc(b.p).replace(/\n/g, "<br>")}</p>`);
    }
    if (b.kv) {
      const rows = b.kv.filter(([, v]) => v);
      text.push(rows.map(([k, v]) => `${k}: ${v}`).join("\n"));
      html.push(
        `<table style="margin:0 0 16px;border-collapse:collapse">${rows
          .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#555;vertical-align:top">${esc(k)}</td><td style="padding:2px 0">${esc(String(v)).replace(/\n/g, "<br>")}</td></tr>`)
          .join("")}</table>`,
      );
    }
    if (b.button) {
      text.push(`${b.button.label}: ${b.button.url}`);
      html.push(
        `<p style="margin:24px 0"><a href="${esc(b.button.url)}" style="background:#123d2b;color:#fffdf8;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">${esc(b.button.label)}</a></p>`,
      );
    }
    if (b.small) {
      text.push(b.small);
      html.push(`<p style="margin:0 0 16px;font-size:13px;color:#555;line-height:1.5">${esc(b.small)}</p>`);
    }
  }
  const footer = support ? `Questions? Reply to this email or contact ${support}.` : "Questions? Reply to this email.";
  text.push(`—\n${org}\n${footer}`);
  html.push(`<hr style="border:none;border-top:1px solid #ddd;margin:24px 0"><p style="font-size:12px;color:#666">${esc(org)}<br>${esc(footer)}</p>`);
  return {
    subject,
    text: text.join("\n\n"),
    html: `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#101512;background:#fffdf8;padding:24px"><div style="max-width:560px;margin:0 auto">${html.join("")}</div></body></html>`,
  };
}

const ROLE_LABEL: Record<string, string> = {
  owner: "platform owner",
  admin: "cohort administrator",
  mentor: "mentor / advisor",
  viewer: "cohort viewer",
  founder: "founder",
};

export type TemplateName =
  | "invitation"
  | "password_reset"
  | "email_change"
  | "week_published"
  | "announcement"
  | "session_published"
  | "session_changed"
  | "session_cancelled"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_rescheduled";

type P = Record<string, string | null | undefined>;

export function render(template: TemplateName, p: P, s: P = {}): Rendered {
  const org = p.org ?? "MAPS Combinator";
  switch (template) {
    case "invitation":
      return compose(
        `You're invited to ${p.cohort ?? org}${p.startup ? ` as a founder of ${p.startup}` : ""}`,
        org,
        [
          { p: `${p.inviter} invited you to join ${org} as a ${ROLE_LABEL[p.role ?? ""] ?? p.role}.` },
          { kv: [["Cohort", p.cohort], ["Startup", p.startup], ["Role", ROLE_LABEL[p.role ?? ""] ?? p.role], ["Invitation expires", p.expires]] },
          { button: { label: "Set up your account", url: s.link ?? "" } },
          { small: `This invitation is for ${p.email} only. If you weren't expecting it, you can ignore this email.` },
        ],
        p.support,
      );
    case "password_reset":
      return compose(`Reset your ${org} password`, org, [
        { p: "Someone (hopefully you) asked to reset the password for this account." },
        { button: { label: "Choose a new password", url: s.link ?? "" } },
        { small: "This link works once and expires in one hour. If you didn't ask for this, ignore this email; your password stays the same." },
      ], p.support);
    case "email_change":
      return compose(`Confirm your new email for ${org}`, org, [
        { p: `Confirm that ${p.newEmail} should become the sign-in email for your ${org} account.` },
        { button: { label: "Confirm new email", url: s.link ?? "" } },
        { small: "If you didn't request this change, ignore this email and nothing will change." },
      ], p.support);
    case "week_published":
      return compose(`Week ${p.week}: ${p.title} — ${p.cohort}`, org, [
        { p: `The guide for Week ${p.week} (${p.dates}) is now available.` },
        { kv: [["Topic", p.title], ["Objective", p.objective], ["Deliverable", p.deliverable]] },
        { button: { label: "Open the weekly guide", url: p.url ?? "" } },
      ], p.support);
    case "announcement":
      return compose(`${p.title} — ${p.cohort}`, org, [{ p: p.body ?? "" }, { button: { label: "View in the platform", url: p.url ?? "" } }], p.support);
    case "session_published":
    case "session_changed":
    case "session_cancelled": {
      const verb = template === "session_published" ? "Office hours scheduled" : template === "session_changed" ? "Updated office hours" : "Cancelled office hours";
      const lead =
        template === "session_cancelled"
          ? `This session has been cancelled${p.reason ? `: ${p.reason}` : "."}`
          : template === "session_changed"
            ? "The details for this session changed. The current details are below."
            : `A group office-hours session is scheduled for ${p.cohort}.`;
      return compose(`${verb}: ${p.title} — ${p.when}`, org, [
        { p: lead },
        { kv: [["Topic", p.title], ["Host", p.host], ["When", p.when], ["Previously", p.previous], ["Where", p.where], ["Preparation", p.preparation]] },
        { button: { label: "Open session details", url: p.url ?? "" } },
      ], p.support);
    }
    case "booking_confirmed":
      return compose(`Confirmed: ${p.startup} × ${p.mentor} — ${p.when}`, org, [
        { p: `Your mentor appointment is confirmed.` },
        { kv: [["Mentor", p.mentor], ["Startup", p.startup], ["When", p.when], ["Duration", p.duration], ["Where", p.where], ["Topic", p.topic], ["Cancellation policy", p.policy]] },
        { button: { label: "View appointment", url: p.url ?? "" } },
      ], p.support);
    case "booking_cancelled":
      return compose(`Cancelled: ${p.startup} × ${p.mentor} — ${p.when}`, org, [
        { p: `This mentor appointment was cancelled by ${p.actor}${p.reason ? `: ${p.reason}` : "."}` },
        { kv: [["Mentor", p.mentor], ["Startup", p.startup], ["Was scheduled for", p.when]] },
        ...(p.url ? [{ button: { label: "Book another time", url: p.url } }] : []),
      ], p.support);
    case "booking_rescheduled":
      return compose(`Rescheduled: ${p.startup} × ${p.mentor} — now ${p.when}`, org, [
        { p: `This mentor appointment was rescheduled by ${p.actor}.` },
        { kv: [["Mentor", p.mentor], ["Startup", p.startup], ["New time", p.when], ["Previous time", p.previous], ["Where", p.where], ["Topic", p.topic]] },
        { button: { label: "View appointment", url: p.url ?? "" } },
      ], p.support);
  }
}
