import type { Metadata } from "next";
import { AcceptInvitation } from "./AcceptInvitation";

export const metadata: Metadata = { title: "Accept invitation", referrer: "no-referrer" };

/**
 * Invitation links look like /accept-invitation#<token>. The fragment never
 * leaves the browser, so tokens don't appear in server, proxy or CDN logs;
 * the page reads it and POSTs it. Viewing never consumes the invitation.
 */
export default function AcceptInvitationPage() {
  return <AcceptInvitation />;
}
