"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { stageCopy } from "@/content/site";

const NAV_LINKS = [
  { label: "How It Works", href: "/#how-it-works" },
  { label: "The Program", href: "/program" },
  { label: "Get Involved", href: "/get-involved" },
  { label: "Contact", href: "/contact" },
];

export function SiteHeader() {
  const [compact, setCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-line/60 bg-paper/95 backdrop-blur transition-all ${
        compact ? "py-2" : "py-4"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5">
        <Link
          href="/"
          className="shrink-0 leading-tight"
          onClick={() => setMenuOpen(false)}
        >
          <span className="block font-display text-xl font-bold tracking-tight text-forest">
            MAPS Combinator
          </span>
          <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink/80">
            12-week equity-free incubator · Greater Seattle
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink/80 transition-colors hover:text-forest"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={stageCopy.primaryCta.href}
            className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-emerald"
          >
            {stageCopy.primaryCta.label}
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-line lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span aria-hidden="true" className="text-lg text-forest">
            {menuOpen ? "✕" : "☰"}
          </span>
        </button>
      </div>

      {menuOpen && (
        <nav
          id="mobile-menu"
          aria-label="Primary"
          className="border-t border-line/60 bg-paper px-5 py-4 lg:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-md px-2 py-2.5 text-base font-medium text-ink/90 hover:bg-cream"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-2">
              <Link
                href={stageCopy.primaryCta.href}
                className="block rounded-full bg-forest px-5 py-3 text-center text-base font-semibold text-paper"
                onClick={() => setMenuOpen(false)}
              >
                {stageCopy.primaryCta.label}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
