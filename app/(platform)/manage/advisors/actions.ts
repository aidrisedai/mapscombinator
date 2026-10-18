"use server";

import { act, str } from "@/lib/server/action";
import { addAdvisorToCohorts, addAdvisors, addExistingAdvisors, previewAdvisorForCohorts, previewAdvisors } from "@/lib/server/domain/advisors";

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

function multiInput(fd: FormData) {
  return {
    name: str(fd, "name"),
    email: str(fd, "email"),
    expertise: str(fd, "expertise"),
    linkedinUrl: str(fd, "linkedinUrl"),
    cohortIds: fd.getAll("cohortId").filter((v): v is string => typeof v === "string"),
  };
}

export async function previewAdvisorForCohortsAction(fd: FormData) {
  return act((actor) => previewAdvisorForCohorts(actor, multiInput(fd)));
}

export async function addAdvisorToCohortsAction(fd: FormData) {
  return act(async (actor) => {
    const r = await addAdvisorToCohorts(actor, multiInput(fd));
    const name = str(fd, "name");
    const parts = [
      r.invited.length && `Invitation sent to ${name} for ${r.invited.join(", ")}${r.willJoin.length ? `; they'll also join ${r.willJoin.join(", ")} when they accept` : ""}.`,
      r.added.length && `${name} already had an account and was added to ${r.added.join(", ")} straight away (they were emailed).`,
      r.already.length && `Already an advisor in ${r.already.join(", ")}.`,
      r.pending.length && `Invitation already pending for ${r.pending.join(", ")}; use Resend below if they lost it.`,
    ].filter(Boolean);
    return { ...r, message: parts.join(" ") || "Nothing to do." };
  });
}

export async function assignAdvisorAction(fd: FormData) {
  return act(async (actor) => {
    const n = await addExistingAdvisors(actor, str(fd, "cohortId"), [str(fd, "accountId")]);
    return { message: n ? "Added. They were emailed; no new sign-up needed." : "Already in that cohort." };
  });
}
