"use server";

import { act, obj, str } from "@/lib/server/action";
import { updateSubmission } from "@/lib/server/domain/submissions";

export async function updateSubmissionAction(fd: FormData) {
  return act(async (actor) => {
    await updateSubmission(actor, str(fd, "submissionId"), obj(fd));
    return { message: "Saved." };
  });
}
