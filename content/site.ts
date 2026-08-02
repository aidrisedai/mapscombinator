import type { SiteConfig } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CENTRAL TRUTH CONTROLS
 *
 * This file is the single source of truth for the site's launch state.
 * An authorized editor changes statuses HERE — pages and components react.
 *
 * How to move stages:
 *  - Board approves the center      → launchStatus: "approved"
 *  - Programs actually operating    → launchStatus: "live"
 *  - Naming/governance approved     → isFormalMapsInitiative: true
 *  - Combinator applications open   → combinatorApplicationsOpen: true and
 *                                     set combinatorApplicationUrl
 *  - First verified events exist    → eventsEnabled: true and add them in
 *                                     content/events.ts
 *  - Two+ verified venture profiles → builderDirectoryEnabled: true and add
 *                                     them in content/ventures.ts
 *
 * TODO_CONFIRM items (never expose this token publicly — the site renders a
 * safe fallback or hides the element instead):
 *  - TODO_CONFIRM: formal board approval status
 *  - TODO_CONFIRM: permitted use of the MAPS name and official logo assets
 *  - TODO_CONFIRM: public contact email (currently the project owner's email)
 *  - TODO_CONFIRM: physical address and whether it may be published
 *  - TODO_CONFIRM: accountable program lead and oversight body
 *  - TODO_CONFIRM: domain name
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const siteConfig: SiteConfig = {
  launchStatus: "planning",
  officialName: "MAPS Center for Entrepreneurship & Innovation",
  shortName: "MAPS Center",
  isFormalMapsInitiative: false,
  contactEmail: "abdulazeezidris28@gmail.com",
  locationLabel: "Greater Seattle, Washington",
  combinatorStatus: "Interest List",
  combinatorApplicationsOpen: false,
  communityFormEnabled: true,
  eventsEnabled: false,
  builderDirectoryEnabled: false,
  eirProgramEnabled: false,
  opportunitiesEnabled: false,
  // formEndpoint: "https://…" — set to a vetted form service or API endpoint
  // to switch forms from the email fallback to direct submission.
  verifiedMetrics: [],
  socialLinks: [],
};

/** Copy that changes with launch stage. Keep wording honest per stage. */
export const stageCopy = {
  heroEyebrow:
    siteConfig.launchStatus === "planning"
      ? "A new initiative being developed at MAPS"
      : "Rooted at MAPS · Built for Greater Seattle",
  aboutIntroVerb:
    siteConfig.launchStatus === "live" ? "is" : "is being developed as",
  primaryCta: siteConfig.combinatorApplicationsOpen
    ? { label: "Apply to MAPS Combinator", href: "/programs/combinator" }
    : { label: "Join the Founding Community", href: "/get-involved#join" },
  secondaryCta: siteConfig.combinatorApplicationsOpen
    ? { label: "Join the Community", href: "/get-involved#join" }
    : { label: "See How It Works", href: "/#how-it-works" },
};
