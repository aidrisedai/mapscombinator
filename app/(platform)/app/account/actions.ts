"use server";

import { act, clientIp, str } from "@/lib/server/action";
import { changePassword, requestEmailChange, updateDisplayName } from "@/lib/server/domain/accounts";

export async function nameAction(fd: FormData) {
  return act((actor) => updateDisplayName(actor, str(fd, "name")));
}
export async function emailAction(fd: FormData) {
  return act(async (actor) => requestEmailChange(actor, str(fd, "currentPassword"), str(fd, "newEmail"), await clientIp()));
}
export async function passwordAction(fd: FormData) {
  return act(async (actor) => changePassword(actor, str(fd, "current"), { password: str(fd, "password"), confirm: str(fd, "confirm") }, await clientIp()));
}
