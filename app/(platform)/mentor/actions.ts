"use server";

import { act, obj, str } from "@/lib/server/action";
import { addException, createRule, previewRule, retireRule, updateMentorProfile, type RuleInput } from "@/lib/server/domain/mentors";

function ruleInput(fd: FormData): RuleInput {
  const o: Record<string, unknown> = obj(fd);
  delete o.mentorId;
  o.cohortIds = fd.getAll("cohortIds").filter((v): v is string => typeof v === "string");
  if (!o.weekday) delete o.weekday;
  if (o.kind !== "weekly") o.endDate = "";
  return o as RuleInput;
}

export async function updateMentorProfileAction(fd: FormData) {
  return act((actor) => updateMentorProfile(actor, str(fd, "mentorId"), obj(fd)));
}

export async function previewRuleAction(fd: FormData) {
  return act((actor) => previewRule(actor, str(fd, "mentorId"), ruleInput(fd)));
}

export async function createRuleAction(fd: FormData) {
  return act(async (actor) => {
    const r = await createRule(actor, str(fd, "mentorId"), ruleInput(fd));
    return { message: `Availability published: ${r.created} bookable time${r.created === 1 ? "" : "s"} are now open to founders.` };
  });
}

export async function retireRuleAction(fd: FormData) {
  return act(async (actor) => {
    const r = await retireRule(actor, str(fd, "mentorId"), str(fd, "ruleId"), str(fd, "acknowledgeBookings") === "1");
    return {
      message: `Availability retired. ${r.withdrawn} open time${r.withdrawn === 1 ? " was" : "s were"} withdrawn${r.keptBookings ? `; ${r.keptBookings} confirmed appointment${r.keptBookings === 1 ? " stays" : "s stay"} booked` : ""}.`,
    };
  });
}

export async function addExceptionAction(fd: FormData) {
  return act(async (actor) => {
    const r = await addException(actor, str(fd, "mentorId"), obj(fd), str(fd, "acknowledgeBookings") === "1");
    return {
      message: `Exception saved. ${r.withdrawn} open time${r.withdrawn === 1 ? " was" : "s were"} withdrawn${r.keptBookings ? `; ${r.keptBookings} confirmed appointment${r.keptBookings === 1 ? " stays" : "s stay"} booked — cancel ${r.keptBookings === 1 ? "it" : "them"} from the appointment page if needed` : ""}.`,
    };
  });
}
