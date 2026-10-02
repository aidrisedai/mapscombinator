import type { Metadata } from "next";
import { ConfirmForm } from "./ConfirmForm";

export const metadata: Metadata = { title: "Confirm", referrer: "no-referrer" };

/**
 * Reset / email-change links look like /auth/confirm#type=…&token_hash=….
 * The fragment never reaches servers or logs, and nothing is consumed until
 * the person presses Continue (email scanners only fetch).
 */
export default function ConfirmPage() {
  return <ConfirmForm />;
}
