import { describe, expect, it } from "vitest";
import { sql } from "@/lib/server/db";
import { createStartup } from "@/lib/server/domain/startups";
import { saveUpdate } from "@/lib/server/domain/updates";
import { publishWeek, saveWeekDraft, addLinkResource } from "@/lib/server/domain/weeks";
import { updateMentorCalendar } from "@/lib/server/domain/mentors";
import { getCohortMentor } from "@/lib/server/domain/bookings";
import { addAdvisorToCohorts, addAdvisors, addExistingAdvisors, addOneAdvisor, advisorDigest, cohortAdvisorsPreview, listAllAdvisors, listOtherAdvisors, parseAdvisorList, previewAdvisors, previewOneAdvisor, teamProgress } from "@/lib/server/domain/advisors";
import { consumeInvitation, hashToken, newToken } from "@/lib/server/domain/invitations";
import { tx } from "@/lib/server/db";
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

  it("the simple form invites one advisor and pre-fills their profile when they join", async () => {
    const w = await world();
    const bad = await previewOneAdvisor(w.admin2, w.C2.id, { name: "", email: "x", linkedinUrl: "https://evil.example/in/x" }).catch((e) => e);
    expect(Object.keys(bad.fieldErrors ?? {})).toEqual(expect.arrayContaining(["name", "email", "linkedinUrl"]));
    const person = await account(w.o, { name: "Nia New" });
    // Not an account yet from the platform's point of view: use a fresh address instead.
    const email = `nia-${w.C2.id.slice(0, 6)}@example.org`;
    const input = { name: "Nia New", email, expertise: "Fundraising, Pricing", linkedinUrl: "linkedin.com/in/nia" };
    expect((await previewOneAdvisor(w.admin2, w.C2.id, input)).action).toBe("invite");
    expect(await addOneAdvisor(w.admin2, w.C2.id, input)).toMatchObject({ action: "invited" });
    expect((await addOneAdvisor(w.admin2, w.C2.id, input)).action).toBe("pending");
    const [inv] = await sql()`select id, profile_prefill from invitations where email = ${email}`;
    expect(inv.profile_prefill).toEqual({ expertise: ["Fundraising", "Pricing"], linkedinUrl: "https://linkedin.com/in/nia" });
    // Accepting copies the pre-fill into the new profile.
    await sql()`update accounts set email = ${email} where id = ${person.id}`;
    const token = newToken();
    await sql()`update invitations set token_hash = ${hashToken(token)} where id = ${inv.id}`;
    await tx((t) => consumeInvitation(t, token, { ...person, email }));
    const [p] = await sql()`select expertise, linkedin_url from mentor_profiles where account_id = ${person.id}`;
    expect(p).toMatchObject({ expertise: ["Fundraising", "Pricing"], linkedin_url: "https://linkedin.com/in/nia" });
  });

  it("the simple form adds an existing account directly and never overwrites what they wrote", async () => {
    const w = await world();
    await sql()`update mentor_profiles set expertise = ${["Hiring"]} where account_id = ${w.vet.id}`;
    const r = await addOneAdvisor(w.admin2, w.C2.id, { name: "Vet", email: w.vet.email, expertise: "Sales", linkedinUrl: "https://www.linkedin.com/in/vet" });
    expect(r).toMatchObject({ action: "added", name: "Veteran Advisor" });
    const [p] = await sql()`select expertise, linkedin_url from mentor_profiles where account_id = ${w.vet.id}`;
    expect(p).toMatchObject({ expertise: ["Hiring"], linkedin_url: "https://www.linkedin.com/in/vet" });
    expect((await addOneAdvisor(w.admin2, w.C2.id, { name: "Vet", email: w.vet.email })).action).toBe("already");
    await expect(addOneAdvisor(w.fa, w.C2.id, { name: "X", email: "x@example.org" })).rejects.toThrow();
  });

  it("advisor dashboard: each startup's published daily and weekly updates, plus the week's guide and materials", async () => {
    const w = await world();
    await addExistingAdvisors(w.admin2, w.C2.id, [w.vet.id]);
    const eb = await createStartup(w.owner, w.C2.id, { name: "Bravo", description: "b", contactName: "B", contactEmail: `b-${w.C2.id.slice(0, 6)}@example.org` });
    const today = todayIn("America/Los_Angeles");
    const before = await advisorDigest(w.vet, w.C2.id, {});
    expect(before.guide.content).toBeNull(); // unpublished guide stays hidden
    const week = before.week;
    await saveUpdate(w.fa, w.C2.id, { enrollmentId: w.ea, kind: "daily", reportDate: today, content: { moved: "Signed pilot", next: "Onboard" }, lockVersion: null, intent: "publish" });
    await saveUpdate(w.fa, w.C2.id, { enrollmentId: w.ea, kind: "weekly", weekNumber: week, content: { accomplished: "Draft only", learned: "x", nextCommitments: "y" }, lockVersion: null, intent: "draft" });
    await saveWeekDraft(w.owner, w.C2.id, week, { title: "Pricing", objective: "Test a price", instructions: "", deliverable: "One pricing page" });
    await addLinkResource(w.owner, w.C2.id, week, { label: "Pricing slides", url: "https://example.org/slides" });
    await publishWeek(w.owner, w.C2.id, week, { sendEmail: false });
    const d = await advisorDigest(w.vet, w.C2.id, { date: today });
    const alpha = d.teams.find((t) => t.id === w.ea)!;
    expect(alpha.daily?.content.moved).toBe("Signed pilot");
    expect(alpha.weekly).toBeNull(); // drafts never show
    expect(alpha.dailiesThisWeek).toBe(1);
    expect(d.teams.find((t) => t.id === eb)).toMatchObject({ daily: null, weekly: null, dailiesThisWeek: 0 });
    expect(d.guide.content).toMatchObject({ title: "Pricing", deliverable: "One pricing page" });
    expect(d.guide.resources.map((r) => r.label)).toEqual(["Pricing slides"]);
    expect(d.days).toHaveLength(7);
    // Out-of-range input falls back safely; founders don't get this view.
    expect((await advisorDigest(w.vet, w.C2.id, { week: 99, date: "not-a-date" })).week).toBe(d.currentWeek);
    await expect(advisorDigest(w.fa, w.C2.id, {})).rejects.toThrow(/advisors/);
    await expect(advisorDigest(w.vet, w.C1.id === w.C2.id ? "" : (await activeCohort(w.owner)).id, {})).rejects.toThrow();
  });

  it("advisors can use their own booking link, shown to founders in their cohort", async () => {
    const w = await world();
    await addExistingAdvisors(w.admin2, w.C2.id, [w.vet.id]);
    const bad = await updateMentorCalendar(w.vet, w.vet.id, { calendarUrl: "javascript:alert(1)" }).catch((e) => e);
    expect(bad.fieldErrors?.calendarUrl).toBeTruthy();
    expect(await updateMentorCalendar(w.vet, w.vet.id, { calendarUrl: "calendly.com/vet/30min" })).toBe("https://calendly.com/vet/30min");
    expect((await getCohortMentor(w.fa, w.C2.id, w.vet.id)).mentor.calendar_url).toBe("https://calendly.com/vet/30min");
    await updateMentorCalendar(w.admin2, w.vet.id, { calendarUrl: "" }); // admin on behalf
    expect((await getCohortMentor(w.fa, w.C2.id, w.vet.id)).mentor.calendar_url).toBeNull();
    await expect(updateMentorCalendar(w.fa, w.vet.id, { calendarUrl: "https://cal.com/x" })).rejects.toThrow();
  });

  it("one advisor across several cohorts: a single invitation, joins all chosen cohorts on accept", async () => {
    const w = await world();
    const email = `multi-${w.C1.id.slice(0, 6)}@example.org`;
    const r = await addAdvisorToCohorts(w.owner, { name: "Multi Advisor", email, expertise: "Sales", cohortIds: [w.C1.id, w.C2.id] });
    expect(r).toMatchObject({ invited: ["Fall"], willJoin: ["Spring"] });
    const invs = await sql()`select id from invitations where email = ${email}`;
    expect(invs).toHaveLength(1);
    const person = await account(w.o, { name: "Multi Advisor" });
    await sql()`update accounts set email = ${email} where id = ${person.id}`;
    const token = newToken();
    await sql()`update invitations set token_hash = ${hashToken(token)} where id = ${invs[0].id}`;
    await tx((t) => consumeInvitation(t, token, { ...person, email }));
    const roles = await sql()`select cohort_id from cohort_roles where account_id = ${person.id} and role = 'mentor' and active order by cohort_id`;
    expect(roles.map((x) => x.cohort_id).sort()).toEqual([w.C1.id, w.C2.id].sort());
    // Existing accounts are added to every chosen cohort at once.
    const again = await addAdvisorToCohorts(w.owner, { name: "Vet", email: w.vet.email, cohortIds: [w.C1.id, w.C2.id] });
    expect(again).toMatchObject({ already: ["Fall"], added: ["Spring"] });
  });

  it("the Advisors section is scoped to the cohorts you manage; cohort members see their advisors", async () => {
    const w = await world();
    const all = await listAllAdvisors(w.owner);
    expect(all.advisors.map((a) => a.id)).toContain(w.vet.id);
    // admin2 manages only Spring, where vet isn't an advisor yet.
    expect((await listAllAdvisors(w.admin2)).advisors.map((a) => a.id)).not.toContain(w.vet.id);
    await expect(addAdvisorToCohorts(w.admin2, { name: "X", email: "x2@example.org", cohortIds: [w.C1.id] })).rejects.toThrow(/cohorts you manage/);
    await expect(listAllAdvisors(w.fa)).rejects.toThrow(/administrators/);
    await addExistingAdvisors(w.admin2, w.C2.id, [w.vet.id]);
    const preview = await cohortAdvisorsPreview(w.fa, w.C2.id);
    expect(preview.advisors.map((a) => a.name)).toEqual(["Veteran Advisor"]);
    const progress = await teamProgress(w.vet, w.C2.id);
    expect(progress?.teams.map((t) => t.name)).toEqual(["Alpha"]);
  });
});
