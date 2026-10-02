/**
 * Browser walkthrough (AC23) against a running LOCAL server configured with
 * AUTH_PROVIDER=local, STORAGE_PROVIDER=local, EMAIL_PROVIDER=log:
 *
 *   npm run dev            # in another terminal
 *   npm run e2e            # BASE_URL=http://localhost:3000 by default
 *
 * Reads invitation links from the development mail log (.data/mail), which
 * is exactly what a real inbox would receive. Screenshots go to .data/e2e/.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DB = process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/maps_dev";
const PW = "correct horse battery";
const run = Date.now().toString(36);
const shots = join(process.cwd(), ".data", "e2e");
mkdirSync(shots, { recursive: true });
const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
    console.log(`✓ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message.split("\n")[0] });
    console.log(`✗ ${name}\n    ${err.message.split("\n").slice(0, 3).join("\n    ")}`);
    throw err;
  }
};

function latestMailTo(email, subjectIncludes) {
  const dir = join(process.cwd(), ".data", "mail");
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir).sort().reverse()) {
    const m = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (m.to === email && (!subjectIncludes || m.subject.includes(subjectIncludes))) return m;
  }
  return null;
}
async function waitForMail(email, subjectIncludes, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const m = latestMailTo(email, subjectIncludes);
    if (m) return m;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no mail to ${email} (${subjectIncludes ?? "any"}) within ${timeout}ms — is the worker running?`);
}
const linkIn = (m) => m.text.match(/https?:\/\/\S+/g).find((u) => u.includes("accept-invitation") || u.includes("/auth/confirm"));

const exe = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ executablePath: exe });
const newPage = async (viewport = { width: 1280, height: 900 }) => {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on("dialog", (d) => d.accept());
  p.on("pageerror", (e) => console.log("   [pageerror]", e.message));
  return p;
};
const shot = (p, name) => p.screenshot({ path: join(shots, `${name}.png`), fullPage: true });

const ownerEmail = `owner-${run}@example.org`;
const founderEmail = `founder-${run}@example.org`;
const cofounderEmail = `cofounder-${run}@example.org`;
const mentorEmail = `mentor-${run}@example.org`;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const daysAgo = (n) => new Date(Date.parse(today) - n * 86400000).toISOString().slice(0, 10);
let cohortUrl = "";
let cohortId = "";

try {
  const owner = await newPage();
  await step("owner bootstrap invitation → account", async () => {
    const out = execFileSync("npx", ["tsx", "scripts/bootstrap-owner.ts", "--print-link"], {
      env: { ...process.env, DATABASE_URL: DB, APP_URL: BASE, OWNER_EMAIL: ownerEmail },
      encoding: "utf8",
    });
    const link = out.match(/https?:\/\/\S+accept-invitation\S+/)[0];
    await owner.goto(link);
    await owner.getByLabel(/^Your name/).fill("Olivia Owner");
    await owner.getByLabel(/^Password/).fill(PW);
    await owner.getByLabel(/^Confirm password/).fill(PW);
    await owner.getByRole("button", { name: /Create account/ }).click();
    await owner.waitForURL(/\/manage/);
  });

  await step("owner creates a cohort (draft) with a week preview", async () => {
    await owner.goto(`${BASE}/manage/cohorts/new`);
    await owner.getByLabel(/^Cohort name/).fill(`E2E Cohort ${run}`);
    await owner.getByLabel(/^Week 1 start date/).fill(daysAgo(8));
    await owner.getByLabel(/^Duration \(weeks\)/).fill("12");
    await owner.getByText(/Week 12/).first().waitFor();
    await shot(owner, "01-new-cohort");
    await owner.getByRole("button", { name: /Save as draft/ }).click();
    await owner.waitForURL(/\/manage\/cohorts\/[0-9a-f-]{36}(\?|$)/);
    cohortUrl = owner.url().split("?")[0];
    cohortId = cohortUrl.split("/").pop();
  });

  await step("owner activates the cohort", async () => {
    await owner.getByRole("button", { name: /Activate/ }).first().click();
    await owner.getByText(/active/i).first().waitFor();
    await owner.waitForTimeout(500);
    await owner.reload();
    await shot(owner, "02-overview-active");
  });

  await step("admin adds a startup and previews + confirms the founder invitation", async () => {
    await owner.goto(`${cohortUrl}/startups`);
    await owner.getByLabel(/^Startup name/).fill(`Acme ${run}`);
    await owner.getByLabel(/^Short description/).fill("Acme helps neighborhood clinics schedule volunteers.");
    await owner.getByLabel(/^Contact name/).first().fill("Fatima Founder");
    await owner.getByLabel(/^Contact email/).first().fill(founderEmail);
    await owner.getByRole("button", { name: /invite/i }).first().click();
    await owner.waitForURL(/startups\/[0-9a-f-]{36}/);
    await owner.getByText("Review before sending").waitFor();
    await owner.getByText(founderEmail).first().waitFor();
    await shot(owner, "03-invite-preview");
    await owner.getByRole("button", { name: /Confirm and send/ }).click();
    await owner.getByText(/Queued|Not sent|Sent/).first().waitFor();
  });

  const founder = await newPage();
  let founderInviteLink = "";
  await step("founder receives the invitation email (dev mail log)", async () => {
    const m = await waitForMail(founderEmail, "invited");
    founderInviteLink = linkIn(m);
    if (!m.text.includes("Founder") && !m.text.includes("founder")) throw new Error("role missing from email");
  });

  await step("founder sets a password without ChatGPT or a platform-sharing step", async () => {
    await founder.goto(founderInviteLink);
    await founder.getByText(`Acme ${run}`).first().waitFor();
    await shot(founder, "04-founder-accept");
    await founder.getByLabel(/^Your name/).fill("Fatima Founder");
    await founder.getByLabel(/^Password/).fill(PW);
    await founder.getByLabel(/^Confirm password/).fill(PW);
    await founder.getByRole("button", { name: /Create account/ }).click();
    await founder.waitForURL(new RegExp(`/app/cohorts/${cohortId}`));
    await founder.getByText(/Write daily update/).waitFor();
    await shot(founder, "05-founder-home");
  });

  await step("founder saves a daily draft that survives reload", async () => {
    await founder.getByRole("link", { name: /Write daily update/ }).click();
    await founder.getByLabel(/^What moved forward today/).fill("Interviewed 3 clinic coordinators.");
    await founder.getByRole("button", { name: /^Save draft/ }).click();
    await founder.getByText("Draft saved.").waitFor();
    await founder.reload();
    const v = await founder.getByLabel(/^What moved forward today/).inputValue();
    if (!v.includes("Interviewed 3")) throw new Error("draft text not persisted");
  });

  await step("publishing requires the required fields and keeps typed text", async () => {
    await founder.getByRole("button", { name: /Publish to cohort/ }).click();
    await founder.getByText(/Fill in the required fields/).waitFor();
    const v = await founder.getByLabel(/^What moved forward today/).inputValue();
    if (!v.includes("Interviewed 3")) throw new Error("text lost after validation error");
  });

  await step("founder publishes the daily update; it appears once in the journal", async () => {
    await founder.getByLabel(/^What's next/).fill("Prototype the shift-swap flow.");
    await founder.getByLabel(/^Evidence or demo link/).fill("javascript:alert(1)");
    await founder.getByRole("button", { name: /Publish to cohort/ }).click();
    await founder.getByText(/https:\/\/ link/).first().waitFor();
    await founder.getByLabel(/^Evidence or demo link/).fill("https://example.org/demo");
    await founder.getByRole("button", { name: /Publish to cohort/ }).click();
    await founder.getByText(/Published\. It's now visible/).waitFor();
    await shot(founder, "06-daily-published");
    await founder.goto(`${BASE}/app/cohorts/${cohortId}/journal`);
    const n = await founder.getByText("Interviewed 3 clinic coordinators.").count();
    if (n !== 1) throw new Error(`expected 1 journal entry, saw ${n}`);
  });

  await step("founder writes the weekly summary with this week's daily notes as reference", async () => {
    await founder.goto(`${BASE}/app/cohorts/${cohortId}/updates/new?kind=weekly`);
    await founder.getByText("Interviewed 3 clinic coordinators.").first().waitFor();
    await founder.getByLabel(/^What did the team accomplish/).fill("Validated the scheduling pain with 3 clinics.");
    await founder.getByLabel(/^What did the team learn/).fill("Coordinators use paper sign-up sheets.");
    await founder.getByLabel(/^Next week's commitments/).fill("Pilot with one clinic.");
    await founder.getByRole("button", { name: /Publish to cohort/ }).click();
    await founder.getByText(/Published\. It's now visible/).waitFor();
  });

  await step("admin sees the update in the participation overview", async () => {
    await owner.goto(cohortUrl);
    await owner.getByText(`Acme ${run}`).first().waitFor();
    await shot(owner, "07-participation");
  });

  await step("admin publishes the week's guide with a PDF; founder opens it", async () => {
    await owner.goto(`${cohortUrl}/weeks/2`);
    await owner.getByLabel(/^Title \/ topic/).fill("Customer discovery");
    await owner.getByLabel(/^Objective/).fill("Talk to ten potential users.");
    await owner.getByRole("button", { name: /^Save draft/ }).click();
    await owner.getByText(/saved/i).first().waitFor();
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
    await owner.locator('input[type="file"]').first().setInputFiles({ name: "discovery.pdf", mimeType: "application/pdf", buffer: pdf });
    const label = owner.getByLabel(/^Label/).last();
    if (await label.count()) await label.fill("Discovery slides");
    await owner.getByRole("button", { name: /^Upload file/ }).click();
    await owner.getByText("discovery.pdf").first().waitFor({ timeout: 15000 });
    await owner.getByRole("button", { name: /^Publish/ }).first().click();
    await owner.getByText(/Published/).first().waitFor();
    await shot(owner, "08-week-admin");
    await founder.goto(`${BASE}/app/cohorts/${cohortId}/weeks/2`);
    await founder.getByRole("heading", { name: "Customer discovery" }).waitFor();
    const href = await founder.locator('a[href^="/api/files/"]').first().getAttribute("href");
    const res = await founder.request.get(`${BASE}${href}`);
    if (res.status() !== 200 || !(await res.body()).subarray(0, 5).toString().startsWith("%PDF")) throw new Error(`file fetch ${res.status()}`);
    const anon = await (await browser.newContext()).request.get(`${BASE}${href}`, { maxRedirects: 0 });
    if (anon.status() < 300 || anon.status() === 200) throw new Error(`anonymous file access returned ${anon.status()}`);
    await shot(founder, "09-week-founder");
  });

  await step("cofounder invitation from Members panel; concurrent edits produce a conflict, not an overwrite", async () => {
    await owner.goto(`${cohortUrl}/startups`);
    await owner.getByRole("link", { name: `Acme ${run}` }).first().click();
    await owner.getByLabel(/^Name/).last().fill("Cole Cofounder");
    await owner.getByLabel(/^Email/).last().fill(cofounderEmail);
    await owner.getByRole("button", { name: /Preview invitation/ }).last().click();
    await owner.getByRole("button", { name: /Confirm and send/ }).click();
    const m = await waitForMail(cofounderEmail, "invited");
    const co = await newPage();
    await co.goto(linkIn(m));
    await co.getByLabel(/^Your name/).fill("Cole Cofounder");
    await co.getByLabel(/^Password/).fill(PW);
    await co.getByLabel(/^Confirm password/).fill(PW);
    await co.getByRole("button", { name: /Create account/ }).click();
    await co.waitForURL(new RegExp(`/app/cohorts/${cohortId}`));
    const url = `${BASE}/app/cohorts/${cohortId}/updates/new?kind=daily&date=${daysAgo(1)}`;
    await founder.goto(url);
    await co.goto(url);
    await founder.getByLabel(/^What moved forward today/).fill("Fatima's version");
    await co.getByLabel(/^What moved forward today/).fill("Cole's version");
    await founder.getByRole("button", { name: /^Save draft/ }).click();
    await founder.getByText("Draft saved.").waitFor();
    await co.getByRole("button", { name: /^Save draft/ }).click();
    await co.getByText(/saved this update at/).waitFor();
    if ((await co.getByLabel(/^What moved forward today/).inputValue()) !== "Cole's version") throw new Error("local text lost on conflict");
    await shot(co, "10-conflict");
  });

  await step("mobile layout: founder home and composer at 390px", async () => {
    const m = await newPage({ width: 390, height: 844 });
    await m.goto(`${BASE}/sign-in`);
    await m.getByLabel(/^Email/).fill(founderEmail);
    await m.getByLabel(/^Password/).fill(PW);
    await m.getByRole("button", { name: /Sign in/ }).click();
    await m.waitForURL(/\/app/);
    await m.goto(`${BASE}/app/cohorts/${cohortId}`);
    await shot(m, "11-mobile-home");
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) throw new Error("horizontal scroll on mobile home");
    await m.goto(`${BASE}/app/cohorts/${cohortId}/updates/new`);
    await shot(m, "12-mobile-composer");
  });

  if (process.env.E2E_SKIP_BOOKING !== "1") {
    let mentorPage;
    await step("admin invites a mentor; mentor publishes availability", async () => {
      await owner.goto(`${cohortUrl}/members`);
      await owner.getByLabel(/^Role/).selectOption({ label: "Mentor" });
      await owner.getByLabel(/^Name/).last().fill("Maya Mentor");
      await owner.getByLabel(/^Email/).last().fill(mentorEmail);
      await owner.getByRole("button", { name: /Preview invitation/ }).last().click();
      await owner.getByRole("button", { name: /Confirm and send/ }).click();
      const m = await waitForMail(mentorEmail, "invited");
      mentorPage = await newPage();
      await mentorPage.goto(linkIn(m));
      await mentorPage.getByLabel(/^Your name/).fill("Maya Mentor");
      await mentorPage.getByLabel(/^Password/).fill(PW);
      await mentorPage.getByLabel(/^Confirm password/).fill(PW);
      await mentorPage.getByRole("button", { name: /Create account/ }).click();
      await mentorPage.waitForURL(/\/mentor\//);
      await mentorPage.goto(`${BASE}/mentor/availability`);
      const day = new Date(Date.parse(today) + 3 * 86400000).toISOString().slice(0, 10);
      await mentorPage.getByLabel(/^Date|^Start date/).first().fill(day);
      await mentorPage.getByLabel(/^Start time/).first().fill("10:00");
      await mentorPage.getByLabel(/^End time/).first().fill("11:00");
      const box = mentorPage.getByRole("checkbox", { name: new RegExp(`E2E Cohort ${run}`) });
      if (!(await box.isChecked())) await box.check();
      await mentorPage.getByRole("button", { name: /Preview/ }).first().click();
      await mentorPage.getByText(/10:00|10:15/).first().waitFor();
      await shot(mentorPage, "13-availability-preview");
      await mentorPage.getByRole("button", { name: /Publish availability/ }).click();
      await mentorPage.getByText(/upcoming|published|slots/i).first().waitFor();
    });

    let bookingUrl = "";
    await step("founder books a mentor; confirmation persists and both get email", async () => {
      await founder.goto(`${BASE}/app/cohorts/${cohortId}/office-hours?tab=mentors`);
      await founder.getByRole("link", { name: /Maya Mentor/ }).first().click();
      await founder.getByRole("button", { name: /10:00/ }).first().click();
      await founder.getByLabel(/^Topic/).fill("Pricing for clinics");
      await founder.getByLabel(/help/i).first().fill("Should we charge per volunteer?");
      await founder.getByRole("button", { name: /Review|Continue/ }).first().click();
      await shot(founder, "14-booking-review");
      await founder.getByRole("button", { name: /Confirm booking/ }).click();
      await founder.waitForURL(/\/app\/appointments\/[0-9a-f-]{36}/);
      bookingUrl = founder.url();
      await founder.getByText(/Confirmed/i).first().waitFor();
      await waitForMail(founderEmail, "Confirmed");
      await waitForMail(mentorEmail, "Confirmed");
      await shot(founder, "15-booking-confirmed");
    });

    await step("founder reschedules; old/new details emailed", async () => {
      await founder.goto(bookingUrl);
      await founder.getByRole("button", { name: /Reschedule/ }).first().click();
      await founder.getByRole("button", { name: /10:15|10:30/ }).first().click();
      await founder.getByRole("button", { name: /Confirm new time|Confirm reschedule|Reschedule to/ }).first().click();
      await founder.waitForURL((u) => u.toString() !== bookingUrl && /appointments\//.test(u.toString()));
      const m = await waitForMail(mentorEmail, "Rescheduled");
      if (!/Previous time/.test(m.text)) throw new Error("reschedule email lacks previous time");
      await shot(founder, "16-rescheduled");
    });
  }
} catch {
  // reported below
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} steps passed. Screenshots: ${shots}`);
  process.exitCode = failed.length ? 1 : 0;
}
