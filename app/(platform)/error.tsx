"use client";

export default function PlatformError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-forest">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink/70">
        This page couldn&apos;t load. Nothing you saved has been lost. {error.digest && <span className="text-ink/50">(ref {error.digest})</span>}
      </p>
      <button onClick={reset} className="mt-6 rounded-md bg-forest px-4 py-2.5 text-sm font-semibold text-paper hover:bg-emerald">
        Try again
      </button>
    </div>
  );
}
