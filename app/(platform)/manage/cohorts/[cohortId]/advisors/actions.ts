"use server";

import { act, str } from "@/lib/server/action";
import { addAdvisors, addExistingAdvisors, previewAdvisors } from "@/lib/server/domain/advisors";

export async function previewAdvisorsAction(fd: FormData) {
  return act((actor) => previewAdvisors(actor, str(fd, "cohortId"), str(fd, "list")));
}

export async function addAdvisorsAction(fd: FormData) {
  return act(async (actor) => {
    const r = await addAdvisors(actor, str(fd, "cohortId"), str(fd, "list"));
    const parts = [
      r.invited && `${r.invited} invitation${r.invited === 1 ? "" : "s"} queued`,
      r.added && `${r.added} existing account${r.added === 1 ? "" : "s"} added (they were emailed)`,
    ].filter(Boolean);
    return { ...r, message: `${parts.join(" and ") || "Nothing new to send"}.${r.problems.length ? ` Not done: ${r.problems.join("; ")}` : ""}` };
  });
}

export async function addExistingAdvisorsAction(fd: FormData) {
  return act(async (actor) => {
    const ids = fd.getAll("accountId").filter((v): v is string => typeof v === "string");
    const n = await addExistingAdvisors(actor, str(fd, "cohortId"), ids);
    return { message: n ? `${n} advisor${n === 1 ? "" : "s"} added. Each one got an email; no new sign-up needed.` : "They were already in this cohort." };
  });
}
