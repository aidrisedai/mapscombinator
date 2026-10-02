"use server";

import { redirect } from "next/navigation";
import { act, obj, str } from "@/lib/server/action";
import { requireCohortAdmin } from "@/lib/server/authz";
import { invalid } from "@/lib/server/errors";
import { cancelSession, createSessions, previewSessions, publishSessions, updateSession } from "@/lib/server/domain/office-hours";

const emails = (n: number, asked: boolean) =>
  asked ? (n ? ` ${n} email${n === 1 ? "" : "s"} queued for delivery.` : " No new emails were queued — recipients already have this version.") : " No email was sent.";

export async function previewSessionsAction(fd: FormData) {
  return act(async (actor) => {
    const a = await requireCohortAdmin(actor, str(fd, "cohortId"));
    return previewSessions(a, obj(fd));
  });
}

/** Create as drafts, then open the first occurrence (publishing is a separate, explicit step). */
export async function createSessionsAction(fd: FormData) {
  const cohortId = str(fd, "cohortId");
  let first = "";
  let count = 0;
  const r = await act(async (actor) => {
    const res = await createSessions(actor, cohortId, obj(fd));
    first = res.ids[0];
    count = res.ids.length;
  });
  if (r.ok) redirect(`/manage/cohorts/${cohortId}/office-hours/${first}?created=${count}`);
  return r;
}

export async function updateSessionAction(fd: FormData) {
  return act(async (actor) => {
    const sendEmail = str(fd, "sendEmail") === "on";
    const r = await updateSession(actor, str(fd, "cohortId"), str(fd, "sessionId"), obj(fd), { scope: str(fd, "scope") === "future" ? "future" : "this", sendEmail });
    return { message: `Saved ${r.changed} occurrence${r.changed === 1 ? "" : "s"}.${emails(r.queued, sendEmail)}` };
  });
}

export async function publishSessionsAction(fd: FormData) {
  return act(async (actor) => {
    const sendEmail = str(fd, "sendEmail") === "on";
    const r = await publishSessions(actor, str(fd, "cohortId"), str(fd, "sessionId"), { wholeSeries: str(fd, "scope") === "series", sendEmail });
    return { message: `Published ${r.published} session${r.published === 1 ? "" : "s"}. Founders can see ${r.published === 1 ? "it" : "them"} now.${emails(r.queued, sendEmail)}` };
  });
}

export async function cancelSessionAction(fd: FormData) {
  return act(async (actor) => {
    const reason = str(fd, "reason").trim();
    if (!reason) throw invalid("Give a reason — founders see it next to the cancelled session.", { reason: "Required." });
    const sendEmail = str(fd, "sendEmail") === "on";
    const r = await cancelSession(actor, str(fd, "cohortId"), str(fd, "sessionId"), { scope: str(fd, "scope") === "future" ? "future" : "this", reason, sendEmail });
    return { message: `Cancelled ${r.cancelled} session${r.cancelled === 1 ? "" : "s"}.${emails(r.queued, sendEmail)}` };
  });
}
