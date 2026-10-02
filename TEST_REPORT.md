# Test report — MAPS Platform r2.1

Date: 2026-10-02. Environment: cloud dev container, Node 22.22, Postgres 16.10 (local), Chromium 141 (Playwright).

**Legend.** **Passed (local)** means verified on this machine with the dev adapters (`AUTH_PROVIDER=local`, `STORAGE_PROVIDER=local`, `EMAIL_PROVIDER=log`). **Not tested** means it needs production credentials or infrastructure that weren't available. Nothing has been deployed yet, so nothing here is "verified live".

> Per the PRD, mock or dev-adapter email/auth tests don't prove production readiness. The Supabase auth adapter, Supabase Storage adapter and Resend delivery are implemented but **not exercised**: no credentials were available in this session.

## Commands and results

| Command | Result |
|---|---|
| `npm run lint` | ✅ 0 problems |
| `npm run typecheck` | ✅ 0 errors |
| `npm test` (Vitest + real Postgres) | ✅ 6 files, 25 tests passed |
| `npm run build` | ✅ succeeded (all platform routes dynamic; marketing pages static) |
| `npm run e2e` against `npm run dev` | ✅ 18/18 steps |
| `npm run e2e` against the **production build** (`npm run start`) | ✅ 18/18 steps |
| Startup config guard (`APP_ENV=production` with dev adapters / http URL) | ✅ refused with an explicit list of the invalid settings |
| Token leakage into the server log during a full e2e run (production build) | ✅ 0 occurrences of invitation/reset tokens (tokens travel in URL fragments and POST bodies) |

Browser walkthrough steps (`scripts/e2e.mjs`; screenshots in `.data/e2e/`):
1. Owner bootstrap link → account → Manage
2. Create cohort (draft) with week preview
3. Activate cohort
4. Add startup → invitation preview (exact recipient, role, message) → confirm
5. Founder receives invitation (dev mail log)
6. Founder sets a password and lands on the startup home. No ChatGPT account and no platform-sharing step involved.
7. Daily draft survives a reload
8. A publish validation error keeps the typed text
9. A `javascript:` link is rejected → publish → exactly one journal entry
10. Weekly summary with that week's daily notes as reference
11. Admin participation overview shows the post
12. Admin publishes a week with an uploaded PDF → founder opens it; anonymous request refused
13. Cofounder invited from the startup page → two teammates edit the same day → conflict screen; local text kept
14. 390 px mobile layout, no horizontal scroll
15. Weekly office-hours series → publish with email → founder sees it, email queued
16. Mentor invited → publishes availability
17. Founder books → confirmation page → confirmation emails to founder and mentor
18. Founder reschedules → old reservation released → reschedule email with previous time

## Acceptance matrix

| AC | Status | Evidence / notes |
|---|---|---|
| AC01 two cohorts, independent weeks/timezones | Passed (local) | `access.test` "keeps two cohorts…" (also settings version conflict) |
| AC02 cross-cohort isolation via URL/fields/filters/exports | Passed (local) | `access.test` "denies an admin of cohort A everything in cohort B": journal, single update, export, startup create, invitations (incl. smuggled enrollment id), filters. Attachment access: `content.test` (other-cohort viewer refused). |
| AC03 invitation → real inbox → setup without ChatGPT | **Partially**: flow passed locally (e2e 4–6); **real inbox not tested** | Needs Resend domain verification + a test inbox |
| AC04 existing-account invite; mismatched account rejected | Passed (local) for mismatch rejection and membership-only grant | `access.test` (different-email consume refused). The UI handles "signed in as someone else" (switch-account) and "existing account → sign in to accept". A browser test of the existing-account path wasn't scripted. |
| AC05 expired/revoked fail; resend invalidates; GET doesn't consume; concurrent accept → one membership | Passed (local) | `access.test` "single-use, mailbox-bound…"; GET lookups never consume (fragment + POST design) |
| AC06 login/logout/reset/email change; reset invalidates sessions; enumeration + brute force | **Partially** | Implemented: generic responses, DB-backed rate limits (login 8/15 min per email and 30 per IP; reset 3/h per email; accept 20/15 min per IP; the e2e reruns hit the accept limit as designed); `signOut("others")` after reset/change. Reset/email-change emails generated through the outbox. **Not tested end to end with Supabase**; local adapter only, and no automated reset-flow test. |
| AC07 roles differ; founder can't alter other team or promote; removal immediate | Passed (local) | `access.test` "founders cannot touch other teams…", "Admin cannot create admins" |
| AC08 draft persists, input preserved on failure, other teams can't read | Passed (local) | e2e 7–8; `access.test` (other team gets no draft payload) |
| AC09 publish appears once; unsafe link/future date rejected; no duplicates | Passed (local) | `updates.test` (concurrent double publish → 1 row; idempotent retry), e2e 9 |
| AC10 weekly summary shows the right week's dailies; required fields; separate | Passed (local) | `updates.test` "weekly summary is separate…", e2e 10 |
| AC11 teammate conflict recoverable; revisions retained | Passed (local) | `updates.test` (UpdateConflict + revisions + immutable trigger), e2e 13 |
| AC12 filters/pagination authorized incl. multi-cohort person | Passed (local) for filters | `access.test` filter by foreign enrollment → empty. Pagination implemented (20/page) but not exercised with >20 rows. |
| AC13 draft week hidden; publish scoped; revisions; doesn't alter submissions | Passed (local) | `content.test` "hides drafts, publishes only to its cohort…" |
| AC14 PDF/PPTX validation, unauthorized download, replacement | **Partially** | Validation (magic bytes, macros, size, type) and authorization: `email.test`, `content.test`, e2e 12. Interrupted upload keeps the previous file by design (pending → ready commit) but isn't fault-injected. Supabase signed URLs expire after 60 s (not exercised: local storage streams bytes). |
| AC15 single + weekly series across DST, correct time/zone | Passed (local) | `content.test` series crossing Nov 1 keeps 17:00 local; `time.test` DST gap/overlap; e2e 15 |
| AC16 edit one vs future; past untouched; cancellation retained | Passed (local) | `content.test` "single edits and future edits are scoped" |
| AC17 preview recipients; no email from drafts; broadcasts only when selected | Passed (local) | `content.test` (drafts send nothing; announcement email only when chosen), e2e 15 |
| AC18 provider failures/retries, bounces, duplicate webhooks, outbox restart, idempotency | Passed (local) for outbox logic | `email.test`: duplicate keys ignored, bounce not regressed, duplicate webhook once, stranded "sending" recovered, admin retry scoped. **Live Resend failure/bounce not tested.** |
| AC19 malicious HTML/URLs, cross-origin, oversized, token logging, public attachments | Passed (local) | `email.test` "input safety"; Server Actions' built-in Origin check + `assertSameOrigin` on `/api/upload`; prod-log token scan; anonymous file request refused (e2e 12) |
| AC20 completed/archived read-only; audited restore | Passed (local) | `access.test` "completed cohorts are read-only…" |
| AC21 migration rehearsal | N/A: fresh build (owner decision) | See MIGRATION.md; import mapping documented |
| AC22 reconnect/redeploy preserve records; restore to a separate environment | **Not tested** | Data lives only in Postgres/Storage. Restore procedure documented in DEPLOYMENT.md §4; rehearsal needs the real Supabase project. |
| AC23 full browser journey desktop + mobile | Passed (local) | e2e 1–18. Keyboard: all controls are native buttons/inputs/links with visible focus. No separate screen-reader audit was done. |
| AC24 fresh install, migrations, typecheck, tests, build, email config, deployed smoke | **Partially** | All local commands pass on a fresh database. Email configuration and deployed smoke checks **not tested** (no credentials). |
| AC25 mentor invite, assigned-cohort visibility, availability, exclusions, DST | Passed (local) | `bookings.test` (DST planning, exceptions, assigned-cohort restriction), e2e 16 |
| AC26 race for one slot; same mentor across cohorts; buffered + startup overlaps | Passed (local) | `bookings.test` race (3 founders, 2 cohorts → exactly 1), buffer/overlap rejection; Postgres exclusion constraints |
| AC27 booking persists before confirmation; one email despite retries; private question | Passed (local) | `bookings.test` idempotent retry → same id, exactly 2 emails; other startup can't read; e2e 17 |
| AC28 reschedule into taken slot keeps old; atomic success; release rules | Passed (local) | `bookings.test` "reschedule is atomic…", e2e 18 |
| AC29 cancellation window, horizon, limits, audited override | Passed (local) | `bookings.test` (limit 2, late founder cancel refused, admin override audited) |
| AC30 availability changes/revocation don't orphan; private history | Passed (local) | `bookings.test` (retire/exception need acknowledgement; mentor removal blocked while appointments exist) |

## Known limitations / not done

- **Production integrations unverified**: Supabase Auth (sign-in, recovery, email change through `generateLink`/`verifyOtp`), Supabase Storage signed URLs, Resend delivery and webhooks. Each adapter is small and isolated in `lib/server/auth/supabase.ts`, `lib/server/storage.ts` and `lib/server/email/provider.ts`.
- **Performance** (< 2 s targets) not measured.
- **Not built**:
  - deleting an availability exception (an exception can still be overridden by adding a replacement-window exception);
  - an `/app/appointments` index page (appointments are listed on the startup home and under Office hours → Appointments);
  - a legacy import script (no legacy data exists).
- **Shared mailbox caveat**: a startup contact email identifies one person; teams using a shared inbox share one login's accountability (the admin UI says this).
- A real invited founder hasn't yet completed onboarding on a deployed instance.
