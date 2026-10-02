"use server";

import { redirect } from "next/navigation";
import { act, obj, str } from "@/lib/server/action";
import { removeOwner, setAccountState } from "@/lib/server/domain/accounts";
import { createCohort, revokeCohortRole, transitionCohort, updateCohortSettings, type CohortSettingsInput } from "@/lib/server/domain/cohorts";
import { createInvitation, previewInvitation, resendInvitation, retryCohortEmail, revokeInvitation, type InviteInput } from "@/lib/server/domain/invitations";
import { updateOrganization } from "@/lib/server/domain/organization";
import { addContact, createStartup, getReturnableStartup, removeMembership, updateStartupProfile, withdrawEnrollment } from "@/lib/server/domain/startups";
import { addLinkResource, publishWeek, removeResource, saveWeekDraft, unpublishWeek } from "@/lib/server/domain/weeks";
import { AppError, invalid } from "@/lib/server/errors";

// Every action re-derives authorization inside the domain layer from the
// signed-in account; ids from the form only name the object being acted on.

const base = (cohortId: string) => `/manage/cohorts/${encodeURIComponent(cohortId)}`;

function cohortInput(fd: FormData): CohortSettingsInput {
  return {
    name: str(fd, "name"),
    description: str(fd, "description"),
    startDate: str(fd, "startDate"),
    weekCount: Number(str(fd, "weekCount") || "0"),
    timezone: str(fd, "timezone"),
    supportEmail: str(fd, "supportEmail"),
  };
}

function weekNumber(fd: FormData) {
  const n = Number(str(fd, "week"));
  if (!Number.isInteger(n) || n < 1 || n > 52) throw invalid("Choose a program week.");
  return n;
}

// ───────────────────────────── Cohorts ─────────────────────────────────────

export async function createCohortAction(fd: FormData) {
  let id = "";
  const r = await act(async (actor) => {
    id = (await createCohort(actor, cohortInput(fd))).id;
  });
  if (r.ok) redirect(`${base(id)}?created=1`);
  return r;
}

export async function updateCohortSettingsAction(fd: FormData) {
  return act(async (actor) => {
    await updateCohortSettings(actor, str(fd, "cohortId"), Number(str(fd, "version")), cohortInput(fd));
  });
}

const TRANSITIONS = ["activate", "complete", "archive", "restore", "reopen"] as const;

export async function transitionCohortAction(fd: FormData) {
  return act(async (actor) => {
    const t = str(fd, "transition") as (typeof TRANSITIONS)[number];
    if (!TRANSITIONS.includes(t)) throw invalid("Unknown action.");
    await transitionCohort(actor, str(fd, "cohortId"), t, str(fd, "reason") || undefined);
  });
}

// ───────────────────────────── Startups ────────────────────────────────────

type Cofounder = { name: string; email: string; index: number };

/** Indexed rows `cofounders.N.name` / `cofounders.N.email`; fully blank rows are skipped. */
function cofounders(fd: FormData): Cofounder[] {
  const out: Cofounder[] = [];
  for (let i = 0; i < 10; i++) {
    const name = str(fd, `cofounders.${i}.name`).trim();
    const email = str(fd, `cofounders.${i}.email`).trim();
    if (name || email) out.push({ name, email, index: i });
  }
  return out;
}

/** Map zod paths for the compacted array back to the row the admin sees. */
function remapCofounderErrors(err: unknown, rows: Cofounder[]): never {
  if (err instanceof AppError && err.fieldErrors) {
    const fe: Record<string, string> = {};
    for (const [k, v] of Object.entries(err.fieldErrors)) {
      const m = /^cofounders\.(\d+)\.(name|email)$/.exec(k);
      fe[m && rows[Number(m[1])] ? `cofounders.${rows[Number(m[1])].index}.${m[2]}` : k] = v;
    }
    throw new AppError(err.code, err.message, fe);
  }
  throw err;
}

export async function createStartupAction(fd: FormData) {
  const cohortId = str(fd, "cohortId");
  let enrollmentId = "";
  const rows = cofounders(fd);
  const r = await act(async (actor) => {
    const existingId = str(fd, "existingStartupId");
    let profile = { name: str(fd, "name"), description: str(fd, "description"), website: str(fd, "website") };
    if (existingId) {
      const s = await getReturnableStartup(actor, cohortId, existingId);
      profile = { name: s.name, description: s.description, website: s.website ?? "" };
    }
    try {
      enrollmentId = await createStartup(
        actor,
        cohortId,
        { ...profile, contactName: str(fd, "contactName"), contactEmail: str(fd, "contactEmail"), cofounders: rows.map(({ name, email }) => ({ name, email })) },
        existingId || undefined,
      );
    } catch (err) {
      remapCofounderErrors(err, rows);
    }
  });
  if (r.ok) {
    const dest = `${base(cohortId)}/startups/${enrollmentId}`;
    if (str(fd, "intent") === "invite") redirect(`${dest}?invite=${encodeURIComponent(str(fd, "contactEmail").trim().toLowerCase())}`);
    redirect(`${dest}?created=1`);
  }
  return r;
}

export async function updateStartupProfileAction(fd: FormData) {
  return act((actor) => updateStartupProfile(actor, str(fd, "cohortId"), str(fd, "enrollmentId"), obj(fd)));
}

export async function removeMembershipAction(fd: FormData) {
  return act((actor) => removeMembership(actor, str(fd, "cohortId"), str(fd, "enrollmentId"), str(fd, "membershipId")));
}

export async function withdrawEnrollmentAction(fd: FormData) {
  const cohortId = str(fd, "cohortId");
  const r = await act((actor) => withdrawEnrollment(actor, cohortId, str(fd, "enrollmentId")));
  if (r.ok) redirect(`${base(cohortId)}/startups?withdrawn=1`);
  return r;
}

// ───────────────────────────── Invitations ─────────────────────────────────

function inviteInput(fd: FormData): InviteInput {
  return {
    role: str(fd, "role") as InviteInput["role"],
    email: str(fd, "email"),
    name: str(fd, "name"),
    cohortId: str(fd, "cohortId") || null,
    enrollmentId: str(fd, "enrollmentId") || null,
  };
}

export type InvitationPreview = { to: string; role: string; cohort: string | null; startup: string | null; subject: string; text: string; alreadyHasAccess: boolean };

/** Step 1: the exact message, recipient and scope. Nothing is stored or sent. */
export async function previewInvitationAction(fd: FormData) {
  return act(async (actor): Promise<InvitationPreview> => previewInvitation(actor, inviteInput(fd)));
}

/** Step 2: create the invitation and queue its email. */
export async function sendInvitationAction(fd: FormData) {
  return act(async (actor) => {
    const input = inviteInput(fd);
    if (str(fd, "addContact") === "1" && input.role === "founder" && input.cohortId && input.enrollmentId) {
      await addContact(actor, input.cohortId, input.enrollmentId, { name: str(fd, "name"), email: str(fd, "email") });
    }
    await createInvitation(actor, input);
  });
}

export async function resendInvitationAction(fd: FormData) {
  return act((actor) => resendInvitation(actor, str(fd, "invitationId")));
}

export async function revokeInvitationAction(fd: FormData) {
  return act((actor) => revokeInvitation(actor, str(fd, "invitationId")));
}

export async function revokeCohortRoleAction(fd: FormData) {
  return act((actor) => revokeCohortRole(actor, str(fd, "cohortId"), str(fd, "roleId")));
}

// ───────────────────────────── Weekly guide ────────────────────────────────

export async function saveWeekDraftAction(fd: FormData) {
  return act(async (actor) => {
    await saveWeekDraft(actor, str(fd, "cohortId"), weekNumber(fd), {
      title: str(fd, "title"),
      objective: str(fd, "objective"),
      instructions: str(fd, "instructions"),
      deliverable: str(fd, "deliverable"),
    });
  });
}

export async function publishWeekAction(fd: FormData) {
  return act(async (actor) => publishWeek(actor, str(fd, "cohortId"), weekNumber(fd), { sendEmail: str(fd, "sendEmail") === "1" }));
}

export async function unpublishWeekAction(fd: FormData) {
  return act((actor) => unpublishWeek(actor, str(fd, "cohortId"), weekNumber(fd)));
}

export async function addLinkResourceAction(fd: FormData) {
  return act((actor) => addLinkResource(actor, str(fd, "cohortId"), weekNumber(fd), { label: str(fd, "label"), url: str(fd, "url") }));
}

export async function removeResourceAction(fd: FormData) {
  return act((actor) => removeResource(actor, str(fd, "cohortId"), str(fd, "resourceId")));
}

// ───────────────────────────── Delivery ────────────────────────────────────

export async function retryEmailAction(fd: FormData) {
  return act((actor) => retryCohortEmail(actor, str(fd, "cohortId"), str(fd, "outboxId")));
}

// ───────────────────────────── Platform (owners) ───────────────────────────

export async function updateOrganizationAction(fd: FormData) {
  return act((actor) =>
    updateOrganization(actor, {
      name: str(fd, "name"),
      supportEmail: str(fd, "supportEmail"),
      replyToEmail: str(fd, "replyToEmail"),
      invitationValidDays: Number(str(fd, "invitationValidDays") || "0"),
    }),
  );
}

export async function removeOwnerAction(fd: FormData) {
  return act((actor) => removeOwner(actor, str(fd, "accountId")));
}

export async function setAccountStateAction(fd: FormData) {
  return act(async (actor) => {
    const state = str(fd, "state");
    if (state !== "active" && state !== "suspended") throw invalid("Unknown account state.");
    await setAccountState(actor, str(fd, "accountId"), state);
  });
}
