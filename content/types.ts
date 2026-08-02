/**
 * Shared content types for the MAPS Combinator site.
 *
 * Everything public-facing flows through these types so the site can move
 * from `planning` to `approved` to `live` by editing data, not components.
 */

export type LaunchStatus = "planning" | "approved" | "live";

/**
 * Verification metadata. Nothing unverified should render as public proof.
 * `permissionToPublish` must be true before a person appears.
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
  /**
   * Optional endpoint for form submissions (e.g. a Formspree/Basin/own API URL).
   * When unset, forms fall back to composing a structured email to contactEmail.
   */
  formEndpoint?: string;
  verifiedMetrics: VerifiedMetric[];
  socialLinks: SocialLink[];
};
