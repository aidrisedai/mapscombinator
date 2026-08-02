import type { VerifiedPerson } from "./types";

/**
 * Verified public people only (team, speakers, mentors).
 *
 * Every public role must have a real person, an active responsibility, and
 * permission to be listed (verification.permissionToPublish: true).
 * No ceremonial titles, no filler portraits.
 */
export const people: VerifiedPerson[] = [];
