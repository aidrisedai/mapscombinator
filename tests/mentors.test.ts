import { describe, expect, it } from "vitest";
import { createStartup } from "@/lib/server/domain/startups";
import { getMentorProfile, profileGaps, updateMentorProfile } from "@/lib/server/domain/mentors";
import { getCohortMentor, listCohortMentors } from "@/lib/server/domain/bookings";
import { account, activeCohort, grant, org } from "./helpers";

async function world() {
  const o = await org();
  const owner = await account(o, { owner: true });
  const mentor = await account(o, { name: "Maya Mentor" });
  const admin1 = await account(o, { name: "Admin One" });
  const fa = await account(o, { name: "Founder A" });
  const fz = await account(o, { name: "Founder Z" });
  const C1 = await activeCohort(owner, "America/Los_Angeles", "C1");
  const C2 = await activeCohort(owner, "America/Los_Angeles", "C2");
  await grant(owner, mentor, "mentor", C1.id);
  await grant(owner, admin1, "admin", C1.id);
  const ea = await createStartup(owner, C1.id, { name: "Alpha", description: "a", contactName: "A", contactEmail: fa.email });
  const ez = await createStartup(owner, C2.id, { name: "Zulu", description: "z", contactName: "Z", contactEmail: fz.email });
  await grant(owner, fa, "founder", C1.id, ea);
  await grant(owner, fz, "founder", C2.id, ez);
  return { owner, mentor, admin1, fa, fz, C1, C2 };
}

const base = { timezone: "America/Los_Angeles" };

describe("mentor / advisor profiles", () => {
  it("stores LinkedIn, calendar, interests and contact details, normalising friendly links", async () => {
    const w = await world();
    expect(profileGaps(await getMentorProfile(w.mentor.id))).toEqual(["headline", "bio", "expertise", "LinkedIn"]);
    await updateMentorProfile(w.mentor, w.mentor.id, {
      ...base,
      headline: "Partner, Cascade Ventures",
      bio: "Two exits.",
      expertise: "Fundraising, Pricing",
      interests: "Climate and health startups",
      linkedinUrl: "linkedin.com/in/maya",
      calendarUrl: "https://calendly.com/maya/20min",
      contactEmail: " Maya@Example.org ",
      phone: "+1 (206) 555-0100",
    });
    const p = await getMentorProfile(w.mentor.id);
    expect(p).toMatchObject({ headline: "Partner, Cascade Ventures", linkedin_url: "https://linkedin.com/in/maya", calendar_url: "https://calendly.com/maya/20min", contact_email: "maya@example.org", phone: "+1 (206) 555-0100", interests: "Climate and health startups" });
    expect(profileGaps(p)).toEqual([]);
  });

  it("rejects unsafe or wrong links and malformed contact details", async () => {
    const w = await world();
    const bad = async (patch: Record<string, string>, field: string) => {
      const err = await updateMentorProfile(w.mentor, w.mentor.id, { ...base, ...patch }).catch((e) => e);
      expect(err?.fieldErrors?.[field], JSON.stringify(patch)).toBeTruthy();
    };
    await bad({ linkedinUrl: "https://evil.example/in/maya" }, "linkedinUrl");
    await bad({ linkedinUrl: "https://linkedin.com.evil.example/x" }, "linkedinUrl");
    await bad({ calendarUrl: "javascript:alert(1)" }, "calendarUrl");
    await bad({ calendarUrl: "http://calendly.com/maya" }, "calendarUrl");
    await bad({ contactEmail: "not-an-email" }, "contactEmail");
    await bad({ phone: "call me maybe" }, "phone");
    await bad({ headline: "x".repeat(161) }, "headline");
    // Blank optional fields clear cleanly.
    await updateMentorProfile(w.mentor, w.mentor.id, { ...base, linkedinUrl: "https://www.linkedin.com/in/maya/", contactEmail: "", phone: "" });
    expect(await getMentorProfile(w.mentor.id)).toMatchObject({ linkedin_url: "https://www.linkedin.com/in/maya/", contact_email: null, phone: null });
  });

  it("founders in the mentor's cohort see the profile and contact; other cohorts don't", async () => {
    const w = await world();
    await updateMentorProfile(w.mentor, w.mentor.id, { ...base, headline: "Advisor", linkedinUrl: "https://www.linkedin.com/in/maya", contactEmail: "maya@example.org", phone: "206 555 0100" });
    const { mentors } = await listCohortMentors(w.fa, w.C1.id);
    expect(mentors[0]).toMatchObject({ headline: "Advisor", linkedin_url: "https://www.linkedin.com/in/maya" });
    const { mentor } = await getCohortMentor(w.fa, w.C1.id, w.mentor.id);
    expect(mentor).toMatchObject({ contact_email: "maya@example.org", phone: "206 555 0100" });
    // A founder of another cohort can neither list nor open this mentor.
    expect((await listCohortMentors(w.fz, w.C2.id)).mentors).toHaveLength(0);
    await expect(getCohortMentor(w.fz, w.C2.id, w.mentor.id)).rejects.toThrow(/isn't available/);
    await expect(getCohortMentor(w.fz, w.C1.id, w.mentor.id)).rejects.toThrow();
  });

  it("admins of the mentor's cohort can fill the profile on their behalf; founders can't", async () => {
    const w = await world();
    await updateMentorProfile(w.admin1, w.mentor.id, { ...base, displayName: "Renamed", headline: "Set by admin" });
    const p = await getMentorProfile(w.mentor.id);
    expect(p).toMatchObject({ headline: "Set by admin", display_name: "Maya Mentor" });
    await expect(updateMentorProfile(w.fa, w.mentor.id, { ...base, headline: "hijack" })).rejects.toThrow();
    await expect(updateMentorProfile(w.fz, w.mentor.id, { ...base, headline: "hijack" })).rejects.toThrow();
  });
});
