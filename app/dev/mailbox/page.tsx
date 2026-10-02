import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { env } from "@/lib/server/env";

export const dynamic = "force-dynamic";

/**
 * DEVELOPMENT ONLY: shows messages written by EMAIL_PROVIDER=log. Returns 404
 * in staging/production and whenever a real provider is configured.
 */
export default function DevMailbox() {
  const e = env();
  if (e.APP_ENV === "production" || e.APP_ENV === "staging" || e.EMAIL_PROVIDER !== "log") notFound();
  const dir = join(process.cwd(), ".data", "mail");
  const files = existsSync(dir) ? readdirSync(dir).sort().reverse().slice(0, 50) : [];
  const mails = files.map((f) => ({ f, ...(JSON.parse(readFileSync(join(dir, f), "utf8")) as { to: string; subject: string; text: string }) }));
  return (
    <main className="mx-auto max-w-3xl p-6 font-mono text-sm">
      <h1 className="mb-1 text-lg font-bold">Development mailbox</h1>
      <p className="mb-6 text-ink/60">Messages captured by EMAIL_PROVIDER=log. Nothing here was delivered to a real inbox.</p>
      {mails.length === 0 && <p>No messages yet.</p>}
      <ol className="space-y-4">
        {mails.map((m) => (
          <li key={m.f} className="rounded border border-line p-4">
            <p><strong>To:</strong> {m.to}</p>
            <p><strong>Subject:</strong> {m.subject}</p>
            <pre className="mt-3 whitespace-pre-wrap break-all">{m.text}</pre>
          </li>
        ))}
      </ol>
    </main>
  );
}
