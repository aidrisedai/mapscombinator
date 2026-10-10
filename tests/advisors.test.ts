import { describe, expect, it } from "vitest";
import { sql } from "@/lib/server/db";
import { createStartup } from "@/lib/server/domain/startups";
import { saveUpdate } from "@/lib/server/domain/updates";
import { addAdvisors, addExistingAdvisors, listOtherAdvisors, parseAdvisorList, previewAdvisors, teamProgress } from "@/lib/server/domain/advisors";
import { todayIn } from "@/lib/time";
import { account, activeCohort, grant, org } from "./helpers";

async function world() {
  const o = await org();
  const owner = await account(o, { owner: true });
  const vet = await account(o, { name: "Veteran Advisor" });
  const admin2 = await account(o, { name: "Admin Two" });
  const fa = await account(o, { name: "Founder A" });
  const C1 = await activeCohort(owner, "America/Los_Angeles", "Fall");
  const C2 = await activeCohort(owner, "America/Los_Angeles", "Spring");
  await grant(owner, vet, "mentor", C1.id);
  await grant(owner, admin2, "admin", C2.id);
  const ea = await createStartup(owner, C2.id, { name: "Alpha", description: "a", contactName: "A", contactEmail: fa.email });
  await grant(owner, fa, "founder", C2.id, ea);
  return { o, owner, vet, admin2, fa, C1, C2, ea };
}

describe("advisor onboarding", () => {
  it("parses pasted lists in common shapes", () => {
    const rows = parseAdvisorList("Maya Chen, maya@example.org\nOmar Haddad <OMAR@example.org>\n\njo@example.org\tJo\nnot an email\nmaya@example.org");
    expect(rows.map((r) => [r.name, r.email, Boolean(r.error)])).toEqual([
      ["Maya Chen", "maya@example.org", false],
      ["Omar Haddad", "omar@example.org", false],
      ["Jo", "jo@example.org", false],
      ["not an email", "", true],
      ["", "maya@example.org", true],
    ]);
  });

  it("invites new people and adds existing accounts directly, without a second sign-up", async () => {
    const w = await world();
    const list = `New Person, new-${w.C2.id.slice(0, 6)}@example.org\nVeteran, ${w.vet.email}`;
    const plan = await previewAdvisors(w.admin2, w.C2.id, list);
    expect(plan.map((p) => p.action)).toEqual(["invite", "add_existing"]);
    const r = await addAdvisors(w.admin2, w.C2.id, list);
    expect(r).toMatchObject({ invited: 1, added: 1, problems: [] });
    const [role] = await sql()`select 1 from cohort_roles where cohort_id = ${w.C2.id} and account_id = ${w.vet.id} and role = 'mentor' and active`;
    expect(role).toBeTruthy();
    const [notice] = await sql()`select count(*)::int as n from email_outbox where template = 'cohort_added' and recipient_email = ${w.vet.email}`;
    expect(notice.n).toBe(1);
    const [noInvite] = await sql()`select count(*)::int as n from invitations where email = ${w.vet.email} and cohort_id = ${w.C2.id}`;
    expect(noInvite.n).toBe(0);
    // Re-running is safe: nothing is duplicated.
    expect((await previewAdvisors(w.admin2, w.C2.id, list)).map((p) => p.action)).toEqual(["pending", "already"]);
    expect(await addAdvisors(w.admin2, w.C2.id, list)).toMatchObject({ invited: 0, added: 0 });
  });

  it("offers advisors from other cohorts and refuses accounts from other organizations", async () => {
    const w = await world();
    const others = await listOtherAdvisors(w.admin2, w.C2.id);
    expect(others.map((x) => x.id)).toEqual([w.vet.id]);
    expect(await addExistingAdvisors(w.admin2, w.C2.id, [w.vet.id])).toBe(1);
    expect(await addExistingAdvisors(w.admin2, w.C2.id, [w.vet.id])).toBe(0);
    expect(await listOtherAdvisors(w.admin2, w.C2.id)).toHaveLength(0);
    const o2 = await org();
    const stranger = await account(o2);
    await expect(addExistingAdvisors(w.admin2, w.C2.id, [stranger.id])).rejects.toThrow(/isn't available/);
    expect((await previewAdvisors(w.admin2, w.C2.id, stranger.email))[0]).toMatchObject({ action: "skip" });
    // An admin of another cohort can't add advisors here; founders can't either.
    await expect(previewAdvisors(w.admin2, w.C1.id, "x@example.org")).rejects.toThrow();
    await expect(addExistingAdvisors(w.fa, w.C2.id, [w.vet.id])).rejects.toThrow();
  });

  it("advisors see published progress per team; founders don't get the cross-team view", async () => {
    const w = await world();
    await addExistingAdvisors(w.admin2, w.C2.id, [w.vet.id]);
    const today = todayIn("America/Los_Angeles");
    await saveUpdate(w.fa, w.C2.id, { enrollmentId: w.ea, kind: "daily", reportDate: today, content: { moved: "Shipped", next: "Pilot" }, lockVersion: null, intent: "publish" });
    const p = await teamProgress(w.vet, w.C2.id);
    expect(p?.byTeam.get(w.ea)).toMatchObject({ dailies: 1, weekly: false, total: 1 });
    expect(await teamProgress(w.fa, w.C2.id)).toBeNull();
  });
});
