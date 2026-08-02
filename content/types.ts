/**
 * Shared content types for the MAPS Center site.
 *
 * Everything public-facing flows through these types so the site can move
 * from `planning` to `approved` to `live` by editing data, not components.
 */

export type LaunchStatus = "planning" | "approved" | "live";

/** Allowed public program/opportunity statuses. Do not invent others. */
export type ProgramStatus =
  | "Open"
  | "Waitlist"
  | "Pilot"
  | "Interest List"
  | "Planned"
  | "Coming Later"
  | "Completed";

/**
 * Verification metadata. Nothing unverified should render as public proof.
 * `permissionToPublish` must be true before a person or venture appears.
 */
export type Verification = {
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  permissionToPublish?: boolean;
  sourceNote?: string;
};

export type VerifiedPerson = {
  id: string;
  name: string;
  role?: string;
  bio?: string;
  photo?: string;
  linkedinUrl?: string;
  verification: Verification;
};

export type VerifiedMetric = {
  label: string;
  value: string;
  verification: Verification;
};

export type SocialLink = {
  label: string;
  url: string;
};

export type SiteConfig = {
  launchStatus: LaunchStatus;
  officialName: string;
  shortName: string;
  isFormalMapsInitiative: boolean;
  mapsRelationshipCopy?: string;
  contactEmail?: string;
  locationLabel: string;
  physicalAddress?: string;
  combinatorStatus: "Planned" | "Interest List" | "Open" | "Waitlist" | "Closed";
  combinatorApplicationsOpen: boolean;
  combinatorApplicationUrl?: string;
  communityFormEnabled: boolean;
  eventsEnabled: boolean;
  builderDirectoryEnabled: boolean;
  eirProgramEnabled: boolean;
  opportunitiesEnabled: boolean;
  /**
   * Optional endpoint for form submissions (e.g. a Formspree/Basin/own API URL).
   * When unset, forms fall back to composing a structured email to contactEmail.
   */
  formEndpoint?: string;
  verifiedMetrics: VerifiedMetric[];
  socialLinks: SocialLink[];
};

export type Program = {
  id: string;
  name: string;
  purpose: string;
  audience: string;
  format: string;
  timeCommitment: string;
  cost: string;
  location: string;
  status: ProgramStatus;
  nextDate: string; // e.g. "To be announced"
  cta: { label: string; href: string };
  pillar: string; // e.g. "01 Gather"
};

export type EventRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  startAt: string;
  endAt: string;
  timezone: string;
  venueName?: string;
  address?: string;
  isOnline: boolean;
  registrationUrl?: string;
  capacity?: number;
  seatsRemaining?: number;
  priceLabel: string;
  audienceLabel: "Open to all" | "Members" | "Application" | "Invite";
  eventType:
    | "Gathering"
    | "Workshop"
    | "Coworking"
    | "Office Hours"
    | "Build Weekend"
    | "Demo Day";
  status: "Draft" | "Open" | "Waitlist" | "Full" | "Completed" | "Cancelled";
  image?: string;
  speakers?: VerifiedPerson[];
  verification: Verification;
};

export type Venture = {
  id: string;
  slug: string;
  name: string;
  logo?: string;
  founders: VerifiedPerson[];
  oneLineProblem: string;
  solutionSummary?: string;
  domain: string;
  stage: "Research" | "Prototype" | "Pilot" | "Early Customers" | "Growing";
  evidence?: string[];
  currentNeed?: string;
  websiteUrl?: string;
  contactRoute?: string;
  programConnection?:
    | "Community"
    | "Build Weekend"
    | "EIR"
    | "MAPS Combinator"
    | "Alumni";
  verifiedAt: string;
  permissionToPublish: boolean;
};
