"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./primitives";

export function PlatformNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  const active = (href: string) =>
    href === "/app" ? path.startsWith("/app") && !path.startsWith("/app/account") : path.startsWith(href.split("/").slice(0, 2).join("/"));
  return (
    <nav aria-label="Primary" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active(l.href) ? "page" : undefined}
          className={cx("rounded-md px-3 py-1.5 text-sm font-medium", active(l.href) ? "bg-forest text-paper" : "text-ink/70 hover:bg-cream hover:text-forest")}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
