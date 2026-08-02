import type { VerifiedPerson } from "@/content/types";

export function PersonCard({ person }: { person: VerifiedPerson }) {
  if (!person.verification.verified || !person.verification.permissionToPublish)
    return null;
  return (
    <article className="rounded-lg border border-line bg-paper p-6">
      <h3 className="font-display text-lg font-bold text-forest">
        {person.name}
      </h3>
      {person.role && <p className="mt-1 text-sm text-ink/70">{person.role}</p>}
      {person.bio && (
        <p className="mt-3 text-sm leading-relaxed text-ink/85">{person.bio}</p>
      )}
      {person.linkedinUrl && (
        <a
          href={person.linkedinUrl}
          className="mt-3 inline-block text-sm font-semibold text-emerald underline underline-offset-4"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
      )}
    </article>
  );
}
