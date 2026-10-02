"use server";

import { redirect } from "next/navigation";
import { act, str } from "@/lib/server/action";
import { bookSlot, SlotTaken } from "@/lib/server/domain/bookings";

/** Book a slot. Redirects to the appointment only after the booking has committed. */
export async function bookSlotAction(fd: FormData) {
  let id = "";
  let slotTaken = false;
  const r = await act(async (actor) => {
    try {
      id = await bookSlot(actor, str(fd, "cohortId"), {
        enrollmentId: str(fd, "enrollmentId"),
        slotId: str(fd, "slotId"),
        idempotencyKey: str(fd, "idempotencyKey"),
        topic: str(fd, "topic"),
        helpNeeded: str(fd, "helpNeeded"),
        link: str(fd, "link"),
      });
    } catch (err) {
      if (err instanceof SlotTaken) slotTaken = true;
      throw err;
    }
  });
  if (r.ok) redirect(`/app/appointments/${id}?booked=1`);
  return { ...r, slotTaken };
}
