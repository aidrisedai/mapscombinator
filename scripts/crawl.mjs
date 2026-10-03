/**
 * QA crawler: signs in as each role and visits every same-site link it can
 * reach (no form submissions), recording HTTP errors, error screens,
 * browser console errors and horizontal overflow at phone width.
 * Usage: CRAWL_USERS="owner@x:pw,founder@x:pw" BASE_URL=... node scripts/crawl.mjs
 */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const users = (process.env.CRAWL_USERS ?? "").split(",").filter(Boolean).map((u) => u.split(":"));
const MAX = Number(process.env.CRAWL_MAX ?? 150);
const browser = await chromium.launch({ executablePath: existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
const problems = [];
let visitedTotal = 0;

const skip = (u) =>
  !u.startsWith(BASE) || /\/api\/(export|files)\//.test(u) || /sign-out|\/dev\//.test(u) || /#/.test(u.replace(BASE, ""));

for (const [email, password] of [["(signed out)", ""], ...users]) {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on("dialog", (d) => d.dismiss());
    let current = "";
    page.on("console", (m) => {
      if (m.type() === "error" && !/hydrat|caret-color/i.test(m.text())) problems.push({ who: email, url: current, kind: "console", detail: m.text().slice(0, 200) });
    });
    page.on("pageerror", (e) => problems.push({ who: email, url: current, kind: "pageerror", detail: e.message.slice(0, 200) }));
    if (password) {
      await page.goto(`${BASE}/sign-in`);
      await page.getByLabel(/^Email/).fill(email);
      await page.getByLabel(/^Password/).fill(password);
      await page.getByRole("button", { name: /Sign in/ }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 20000 });
    }
    const queue = [password ? `${BASE}/app` : `${BASE}/`];
    const seen = new Set();
    while (queue.length && seen.size < MAX) {
      const url = queue.shift();
      const key = url.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id").replace(/\?.*$/, (q) => (q.includes("tab=") || q.includes("kind=") ? q : ""));
      if (seen.has(key)) continue;
      seen.add(key);
      current = url;
      let res;
      try {
        res = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      } catch (e) {
        problems.push({ who: email, url, kind: "timeout", detail: e.message.split("\n")[0] });
        continue;
      }
      const status = res?.status() ?? 0;
      const body = await page.locator("body").innerText().catch(() => "");
      if (status >= 500) problems.push({ who: email, url, kind: `http ${status}`, detail: "" });
      if (/Something went wrong|Application error|Internal Server Error/.test(body)) problems.push({ who: email, url, kind: "error screen", detail: body.match(/.*(Something went wrong|Application error).*/)?.[0] ?? "" });
      if (/undefined|NaN|\[object Object\]|Invalid Date/.test(body)) problems.push({ who: email, url, kind: "suspicious text", detail: body.match(/.{0,40}(undefined|NaN|\[object Object\]|Invalid Date).{0,40}/)?.[0] ?? "" });
      if (viewport.width < 500) {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 2) problems.push({ who: email, url, kind: "mobile overflow", detail: `${over}px wider than screen` });
      }
      const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
      for (const l of links) if (!skip(l)) queue.push(l.split("#")[0]);
    }
    visitedTotal += seen.size;
    console.log(`${email} @${viewport.width}px: ${seen.size} pages`);
    await ctx.close();
  }
}
await browser.close();
const uniq = [...new Map(problems.map((p) => [`${p.kind}|${p.url.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id")}|${p.detail}`, p])).values()];
console.log(`\nVisited ${visitedTotal} page loads. ${uniq.length} distinct problem(s):`);
for (const p of uniq) console.log(`- [${p.kind}] ${p.who} ${p.url.replace(BASE, "")} ${p.detail}`);
process.exitCode = uniq.length ? 1 : 0;
