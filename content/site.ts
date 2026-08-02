import type { SiteConfig } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CENTRAL TRUTH CONTROLS — MAPS COMBINATOR
 *
 * This site presents ONE program: MAPS Combinator. Messaging for the broader
 * MAPS Center for Entrepreneurship & Innovation is owned by a separate team
 * and intentionally not represented here.
 *
 * This file is the single source of truth for the site's launch state.
 * An authorized editor changes statuses HERE — pages and components react.
 *
 * How to move stages:
 *  - Program approved by MAPS       → launchStatus: "approved"
 *  - Cohort actually operating      → launchStatus: "live"
 *  - Naming/governance approved     → isFormalMapsInitiative: true
 *  - Applications open              → combinatorApplicationsOpen: true,
 *                                     combinatorStatus: "Open", and set
 *                                     combinatorApplicationUrl
 *
 * TODO_CONFIRM items (never expose this token publicly — the site renders a
 * safe fallback or hides the element instead):
 *  - TODO_CONFIRM: formal approval status of the program
 *  - TODO_CONFIRM: permitted use of the MAPS name and official logo assets
 *  - TODO_CONFIRM: public contact email (currently the project owner's email)
 *  - TODO_CONFIRM: cohort dates, capacity, schedule, and selection owner
 *  - TODO_CONFIRM: facility details and whether they may be published
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const siteConfig: SiteConfig = {
  launchStatus: "planning",
  officialName: "MAPS Combinator",
  shortName: "MAPS Combinator",
  isFormalMapsInitiative: false,
  contactEmail: "abdulazeezidris28@gmail.com",
  locationLabel: "Greater Seattle, Washington",
  combinatorStatus: "Interest List",
  combinatorApplicationsOpen: false,
  // formEndpoint: "https://…" — set to a vetted form service or API endpoint
  // to switch forms from the email fallback to direct submission.
  verifiedMetrics: [],
  socialLinks: [],
};

/** Copy that changes with launch stage. Keep wording honest per stage. */
export const stageCopy = {
  heroEyebrow:
    siteConfig.launchStatus === "planning"
      ? "A new program being developed at MAPS · Greater Seattle"
      : "A MAPS program · Greater Seattle",
  primaryCta: siteConfig.combinatorApplicationsOpen
    ? {
        label: "Apply to MAPS Combinator",
        href: siteConfig.combinatorApplicationUrl ?? "/#interest",
      }
    : { label: "Join the Interest List", href: "/#interest" },
};
