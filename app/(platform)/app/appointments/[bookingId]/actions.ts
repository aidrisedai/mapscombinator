"use server";

import { redirect } from "next/navigation";
import { act, str } from "@/lib/server/action";
import { cancelBooking, markOutcome, rescheduleBooking, SlotTaken } from "@/lib/server/domain/bookings";

export async function cancelBookingAction(fd: FormData) {
  return act(async (actor) => {
    await cancelBooking(actor, str(fd, "bookingId"), str(fd, "reason"));
    return { message: "Appointment cancelled. The team and the mentor are being notified by email." };
  });
}

/** Reserve the new slot and cancel the old one atomically; go to the new appointment only after it commits. */
export async function rescheduleBookingAction(fd: FormData) {
  let id = "";
  let slotTaken = false;
  const r = await act(async (actor) => {
    try {
      id = await rescheduleBooking(actor, str(fd, "bookingId"), str(fd, "slotId"), str(fd, "idempotencyKey"), str(fd, "reason"));
    } catch (err) {
      if (err instanceof SlotTaken) slotTaken = true;
      throw err;
    }
  });
  if (r.ok) redirect(`/app/appointments/${id}?rescheduled=1`);
  return { ...r, slotTaken };
}

export async function markOutcomeAction(fd: FormData) {
  const outcome = str(fd, "outcome") === "no_show" ? "no_show" : "completed";
  return act(async (actor) => markOutcome(actor, str(fd, "bookingId"), outcome));
}
