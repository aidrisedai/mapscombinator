"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { runAssistant, type AiKind, type ChatTurn } from "@/lib/server/ai/assistant";
import { runAction } from "@/lib/server/errors";
import { createStartup } from "@/lib/server/domain/startups";
import { AppError } from "@/lib/server/errors";
import { requireAccount } from "@/lib/server/session";

export async function aiAssistAction(kind: AiKind, ctx: { cohortId?: string; enrollmentId?: string; mentorId?: string; weekNumber?: number }, turns: ChatTurn[]) {
  return runAction(async () => runAssistant(await requireAccount(), kind, ctx, Array.isArray(turns) ? turns : []));
}

const startupDraft = z.object({
  name: z.string(),
  description: z.string(),
  website: z.string().optional().default(""),
  contactName: z.string(),
  contactEmail: z.string(),
  cofounders: z.array(z.object({ name: z.string(), email: z.string() })).max(10).optional().default([]),
});

/**
 * Saves reviewed AI startup drafts one by one (each is independently
 * validated and authorized). No invitations are sent.
 */
export async function saveDraftStartupsAction(cohortId: string, drafts: unknown[]) {
  return runAction(async () => {
    const actor = await requireAccount();
    if (!Array.isArray(drafts) || drafts.length === 0 || drafts.length > 50) throw new AppError("validation", "Nothing to save.");
    const results: { ok: boolean; enrollmentId?: string; error?: string; fieldErrors?: Record<string, string> }[] = [];
    for (const d of drafts) {
      const parsed = startupDraft.safeParse(d);
      if (!parsed.success) {
        results.push({ ok: false, error: "This draft is incomplete." });
        continue;
      }
      try {
        results.push({ ok: true, enrollmentId: await createStartup(actor, cohortId, parsed.data) });
      } catch (err) {
        if (err instanceof AppError) results.push({ ok: false, error: err.message, fieldErrors: err.fieldErrors });
        else throw err;
      }
    }
    if (results.some((r) => r.ok)) refresh();
    return results;
  });
}
