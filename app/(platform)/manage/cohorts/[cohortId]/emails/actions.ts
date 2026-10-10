"use server";

import { act, obj, str } from "@/lib/server/action";
import {
  deleteSavedTemplate,
  previewAutoTemplate,
  previewMessage,
  resetAutoTemplate,
  saveAutoTemplate,
  saveSavedTemplate,
  sendAutoTemplateTest,
  sendMessage,
  type MessageInput,
} from "@/lib/server/domain/emails";

function messageInput(fd: FormData): MessageInput {
  return {
    audience: str(fd, "audience") as MessageInput["audience"],
    enrollmentIds: fd.getAll("enrollmentId").filter((v): v is string => typeof v === "string"),
    includeMentors: str(fd, "includeMentors") === "on",
    copyMe: str(fd, "copyMe") === "on",
    subject: str(fd, "subject"),
    body: str(fd, "body"),
  };
}

export async function previewMessageAction(fd: FormData) {
  return act((actor) => previewMessage(actor, str(fd, "cohortId"), messageInput(fd)));
}

export async function sendMessageAction(fd: FormData) {
  return act(async (actor) => {
    const r = await sendMessage(actor, str(fd, "cohortId"), { ...messageInput(fd), idempotencyKey: str(fd, "idempotencyKey") });
    return { ...r, message: `Sent: ${r.queued} email${r.queued === 1 ? "" : "s"} queued, one per person. Delivery appears under “Sent emails”.` };
  });
}

export async function saveSavedTemplateAction(fd: FormData) {
  return act(async (actor) => {
    const r = await saveSavedTemplate(actor, str(fd, "cohortId"), obj(fd));
    return { message: r === "created" ? "Saved as a template." : "Template updated." };
  });
}

export async function deleteSavedTemplateAction(fd: FormData) {
  return act((actor) => deleteSavedTemplate(actor, str(fd, "cohortId"), str(fd, "templateId")));
}

export async function saveAutoTemplateAction(fd: FormData) {
  return act(async (actor) => {
    await saveAutoTemplate(actor, str(fd, "cohortId"), str(fd, "kind"), obj(fd));
    return { message: "Saved. New emails of this kind use your wording." };
  });
}

export async function resetAutoTemplateAction(fd: FormData) {
  return act(async (actor) => {
    await resetAutoTemplate(actor, str(fd, "cohortId"), str(fd, "kind"));
    return { message: "Back to the standard wording." };
  });
}

export async function previewAutoTemplateAction(fd: FormData) {
  return act((actor) => previewAutoTemplate(actor, str(fd, "cohortId"), str(fd, "kind"), obj(fd)));
}

export async function testAutoTemplateAction(fd: FormData) {
  return act(async (actor) => {
    const to = await sendAutoTemplateTest(actor, str(fd, "cohortId"), str(fd, "kind"), obj(fd));
    return { message: `Test sent to ${to}.` };
  });
}
