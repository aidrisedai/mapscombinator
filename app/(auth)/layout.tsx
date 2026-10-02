import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-cream/50">
      <header className="px-5 py-5">
        <Link href="/" className="font-display text-lg font-bold text-forest">
          MAPS Combinator
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 sm:pt-12">
        <div className="w-full max-w-md rounded-xl border border-line bg-paper p-6 shadow-sm sm:p-8">{children}</div>
      </main>
    </div>
  );
}
