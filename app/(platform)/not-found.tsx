import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-forest">Not found</h1>
      <p className="mt-2 text-sm text-ink/70">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/app" className="mt-6 inline-block text-sm font-medium text-emerald hover:text-forest">Back to my program</Link>
    </div>
  );
}
