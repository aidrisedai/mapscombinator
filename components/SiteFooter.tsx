import Link from "next/link";
import { siteConfig } from "@/content/site";
import { SoundContour } from "./SoundContour";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-forest text-cream">
      <SoundContour className="pointer-events-none absolute inset-x-0 bottom-0 h-48 w-full text-moss/40" />
      <div className="relative mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="font-display text-lg font-bold">
              MAPS Center for Entrepreneurship &amp; Innovation
            </p>
            {siteConfig.isFormalMapsInitiative ? (
              <p className="mt-2 text-sm text-cream/80">An initiative of MAPS</p>
            ) : (
              <p className="mt-2 text-sm text-cream/80">
                A community initiative in development
              </p>
            )}
            <p className="mt-4 text-sm text-cream/80">
              {siteConfig.physicalAddress ?? siteConfig.locationLabel}
            </p>
          </div>

          <nav aria-label="Footer" className="text-sm">
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="hover:text-moss">
                  About
                </Link>
              </li>
              <li>
                <Link href="/programs" className="hover:text-moss">
                  Programs
                </Link>
              </li>
              <li>
                <Link href="/events" className="hover:text-moss">
                  Events
                </Link>
              </li>
              <li>
                <Link href="/get-involved" className="hover:text-moss">
                  Get Involved
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-moss">
                  Contact
                </Link>
              </li>
            </ul>
          </nav>

          <div className="text-sm">
            <ul className="space-y-2">
              {siteConfig.contactEmail && (
                <li>
                  <a
                    href={`mailto:${siteConfig.contactEmail}`}
                    className="hover:text-moss"
                  >
                    {siteConfig.contactEmail}
                  </a>
                </li>
              )}
              {siteConfig.socialLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    className="hover:text-moss"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/privacy" className="hover:text-moss">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-moss">
                  Terms
                </Link>
              </li>
              {siteConfig.contactEmail && (
                <li>
                  <a
                    href={`mailto:${siteConfig.contactEmail}?subject=Accessibility%20feedback`}
                    className="hover:text-moss"
                  >
                    Accessibility contact
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <p className="mt-12 border-t border-cream/20 pt-6 text-xs text-cream/70">
          © {new Date().getFullYear()} MAPS Center for Entrepreneurship &amp;
          Innovation. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
