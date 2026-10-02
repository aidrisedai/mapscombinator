"use server";

import { act, obj, str } from "@/lib/server/action";
import { updatePolicy } from "@/lib/server/domain/bookings";

export async function updatePolicyAction(fd: FormData) {
  return act((actor) => updatePolicy(actor, str(fd, "cohortId"), obj(fd)));
}
