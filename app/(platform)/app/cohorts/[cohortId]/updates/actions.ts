"use server";

import { runAction } from "@/lib/server/errors";
import { act, str } from "@/lib/server/action";
import { moderateUpdate, saveUpdate, UpdateConflict, type SaveInput } from "@/lib/server/domain/updates";
import { requireAccount } from "@/lib/server/session";
import { updateStartupProfile } from "@/lib/server/domain/startups";
import { obj } from "@/lib/server/action";

export type SaveUpdateResponse =
  | { ok: true; data: { id: string; lockVersion: number; state: "draft" | "published"; savedAt: string; revision: number } }
  | { ok: false; code: string; error: string; fieldErrors?: Record<string, string>; current?: UpdateConflict["current"] };

export async function saveUpdateAction(cohortId: string, input: SaveInput): Promise<SaveUpdateResponse> {
  try {
    const actor = await requireAccount();
    const data = await saveUpdate(actor, cohortId, input);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof UpdateConflict) return { ok: false, code: "conflict", error: err.message, current: err.current };
    const r = await runAction(async () => {
      throw err;
    });
    return r as SaveUpdateResponse;
  }
}

export async function moderateAction(fd: FormData) {
  return act((actor) => moderateUpdate(actor, str(fd, "cohortId"), str(fd, "updateId"), str(fd, "hide") === "1", str(fd, "reason")));
}

export async function updateProfileAction(fd: FormData) {
  return act((actor) => updateStartupProfile(actor, str(fd, "cohortId"), str(fd, "enrollmentId"), obj(fd)));
}
