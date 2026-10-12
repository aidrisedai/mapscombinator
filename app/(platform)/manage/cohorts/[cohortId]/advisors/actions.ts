"use server";

import { act, obj, str } from "@/lib/server/action";
import { addAdvisors, addExistingAdvisors, addOneAdvisor, previewAdvisors, previewOneAdvisor } from "@/lib/server/domain/advisors";

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

export async function previewOneAdvisorAction(fd: FormData) {
  return act((actor) => previewOneAdvisor(actor, str(fd, "cohortId"), obj(fd)));
}

export async function addOneAdvisorAction(fd: FormData) {
  return act(async (actor) => {
    const r = await addOneAdvisor(actor, str(fd, "cohortId"), obj(fd));
    const message = {
      invited: `Invitation sent to ${r.name}. They'll confirm their email with a code, set a password and complete their profile.`,
      added: `${r.name} already had an account, so they were added straight away and emailed. No new sign-up needed.`,
      already: `${r.name} is already an advisor in this cohort.`,
      pending: `${r.name} already has a pending invitation. Use Resend under “Pending advisor invitations” if they lost it.`,
    }[r.action];
    return { ...r, message };
  });
}
