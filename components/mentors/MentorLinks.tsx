/** External profile/contact links for a mentor. Shown only inside cohorts the mentor is assigned to. */
export function MentorLinks({ m, contact = false }: { m: Record<string, unknown>; contact?: boolean }) {
  const linkedin = m.linkedin_url as string | null;
  const calendar = m.calendar_url as string | null;
  const email = contact ? (m.contact_email as string | null) : null;
  const phone = contact ? (m.phone as string | null) : null;
  if (!linkedin && !calendar && !email && !phone) return null;
  const cls = "font-medium text-emerald underline-offset-2 hover:text-forest hover:underline";
  return (
    <ul className="flex flex-col gap-1.5 text-sm" aria-label="Links and contact">
      {linkedin && (
        <li>
          <a className={cls} href={linkedin} target="_blank" rel="noopener noreferrer nofollow">LinkedIn profile ↗</a>
        </li>
      )}
      {calendar && (
        <li>
          <a className={cls} href={calendar} target="_blank" rel="noopener noreferrer nofollow">Book on their calendar ↗</a>
        </li>
      )}
      {email && (
        <li>
          <span className="text-ink/60">Email: </span>
          <a className={cls} href={`mailto:${email}`}>{email}</a>
        </li>
      )}
      {phone && (
        <li>
          <span className="text-ink/60">Phone: </span>
          <a className={cls} href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>{phone}</a>
        </li>
      )}
    </ul>
  );
}
