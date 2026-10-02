"use server";

import { redirect } from "next/navigation";
import { act, obj, str } from "@/lib/server/action";
import { publishAnnouncement, saveAnnouncement, unpublishAnnouncement } from "@/lib/server/domain/announcements";

/** Create (then open the draft) or save an existing announcement. */
export async function saveAnnouncementAction(fd: FormData) {
  const cohortId = str(fd, "cohortId");
  const existing = str(fd, "announcementId") || null;
  let id = "";
  const r = await act(async (actor) => {
    id = await saveAnnouncement(actor, cohortId, existing, obj(fd));
    return { message: "Saved." };
  });
  if (r.ok && !existing) redirect(`/manage/cohorts/${cohortId}/announcements/${id}?created=1`);
  return r;
}

export async function publishAnnouncementAction(fd: FormData) {
  return act(async (actor) => {
    const sendEmail = str(fd, "sendEmail") === "on";
    const wasPublished = str(fd, "wasPublished") === "1";
    const r = await publishAnnouncement(actor, str(fd, "cohortId"), str(fd, "announcementId"), { sendEmail });
    const email = sendEmail
      ? r.queued
        ? ` ${r.queued} email${r.queued === 1 ? "" : "s"} queued for delivery.`
        : " No new emails were queued — recipients already have this version."
      : " No email was sent.";
    return { message: `${wasPublished ? "Email copy requested." : "Published. Founders can see it now."}${email}` };
  });
}

export async function unpublishAnnouncementAction(fd: FormData) {
  return act((actor) => unpublishAnnouncement(actor, str(fd, "cohortId"), str(fd, "announcementId")));
}
