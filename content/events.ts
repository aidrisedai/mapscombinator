import type { EventRecord } from "./types";

/**
 * Verified events only. Do not add an event until date, time, venue, price,
 * and registration details are confirmed by the accountable program lead.
 *
 * How to add an event:
 * 1. Fill in every required field below (see EventRecord in ./types.ts).
 * 2. Set verification.verified = true, verifiedBy, and verifiedAt.
 * 3. Set eventsEnabled: true in content/site.ts so events surface on the
 *    homepage and the Events page shows the calendar instead of the
 *    launch-updates empty state.
 *
 * Only show seatsRemaining when it is connected to reliable registration data.
 */
export const events: EventRecord[] = [];
