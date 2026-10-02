# Deployment — Railway + Supabase + Resend

The platform is one Next.js 16 service: web plus an in-process background worker. It runs on **Railway**, with **Supabase** providing Postgres, Auth and private Storage, and **Resend** for transactional email. Nothing here needs Vercel or GitHub Pages; the old Pages workflow was removed.

```
Browser ──HTTPS──▶ Railway service (Next.js server + outbox/slot worker)
                       │            │               │
                       ▼            ▼               ▼
              Supabase Postgres  Supabase Auth   Supabase Storage (private bucket)
                                                    Resend API ◀── webhook ── /api/webhooks/resend
```

## 1. Supabase project

1. Create a project (choose a region near Seattle, e.g. `us-west-1`).
2. **Database URL**: Project Settings → Database → Connection string → **Session pooler** URI (IPv4-compatible). Use it as `DATABASE_URL` with `DATABASE_SSL=require`. Don't use the transaction pooler (port 6543): the app uses transactions and advisory locks.
3. **Auth settings** (Authentication → Providers / Settings):
   - Email provider: **enabled**. **Disable "Allow new users to sign up"**: accounts are created only by the platform when a valid invitation is accepted, via the admin API.
   - **Disable "Secure email change"**. The platform sends its own single-use confirmation link to the *new* address and requires the current password first.
   - Minimum password length: **10** (matches the app's check).
   - Site URL: your `APP_URL`.
   - JWT expiry: default 3600 s. Sessions refresh through `proxy.ts`. Supabase's "time-box user sessions" / inactivity timeout (paid plans) can cap session lifetime; document whatever you choose.
   - Supabase's own emails aren't used for invitations, resets or email changes; the platform generates those links and sends them through its outbox. You may still point Supabase SMTP at Resend (Auth → SMTP) so that any Supabase-originated mail is branded.
4. **Storage**: create a bucket named `weekly-resources` and make sure it's **Private** (not public). The app uses the service-role key server-side and issues 60-second signed URLs only after an authorization check.
5. Copy `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API). The service-role key is **server-only**.

> Row Level Security: the app connects as the database owner and enforces every scope in server code (tested in `tests/access.test.ts`). The anon key isn't used for data access. Leave RLS enabled with no policies on these tables so the anon/public API can't read them.

## 2. Resend

1. Add and verify your sending domain (Domains → Add). Create the SPF/DKIM (and recommended DMARC) DNS records Resend shows. **Real invitations can't be sent until this is verified.**
2. Create an API key with "Sending access" → `RESEND_API_KEY`.
3. Add a webhook endpoint `https://<APP_URL>/api/webhooks/resend` for `email.sent`, `email.delivered`, `email.bounced`, `email.complained` and `email.failed`, then copy its signing secret → `RESEND_WEBHOOK_SECRET`. Without this, messages stay at "Accepted by provider" and are never shown as delivered.
4. Set `EMAIL_FROM` to an address on the verified domain, e.g. `MAPS Combinator <program@yourdomain.org>`, and `EMAIL_REPLY_TO` to a monitored inbox.
5. **Staging/acceptance**: set `EMAIL_SANDBOX_ALLOWLIST=you@yourdomain.org,tester@...` so only approved test inboxes get mail; everything else is recorded as "Not sent (sandbox)". **Clear it for production.**

## 3. Railway

1. New Project → Deploy from GitHub repo → this repository (branch of your choice). Railway reads `railway.json` and builds the `Dockerfile`.
2. Service → Variables: set everything from `.env.example`:

   | Variable | Production value |
   |---|---|
   | `APP_ENV` | `production` |
   | `APP_URL` | `https://<your domain>` (or the Railway-provided `*.up.railway.app` URL) |
   | `DATABASE_URL` / `DATABASE_SSL` | Supabase session-pooler URI / `require` |
   | `AUTH_PROVIDER` / `STORAGE_PROVIDER` | `supabase` / `supabase` |
   | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | from Supabase |
   | `EMAIL_PROVIDER` | `resend` |
   | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | from Resend |
   | `RUN_WORKER_IN_PROCESS` | `true` |

   The app **refuses to start** in staging/production with dev adapters (local auth/storage/log email) or a non-https URL.
3. Settings → Networking → Generate domain, or add your custom domain (CNAME). If you change domains later, update `APP_URL`; links in emails use it.
4. Deploy. The container runs `npm run start:prod`, which applies pending SQL migrations under an advisory lock and then starts the server. The health check is `GET /api/health` (DB reachability plus outbox backlog).
5. **Bootstrap the first owner**: there's no "first visitor becomes admin". From your machine, with the production variables exported (or `railway run`):

   ```bash
   railway run npm run bootstrap:owner -- --print-link   # prints a single-use owner link
   # or, once the Resend domain is verified:
   railway run npm run bootstrap:owner                   # emails the owner invitation
   ```

   `OWNER_EMAIL` defaults to the value in your variables. Open the link, set your name and password, and you land in **Manage**.

### Worker

The worker drains the email outbox every 5 s (with `FOR UPDATE SKIP LOCKED`), extends mentor availability slots hourly, and cleans orphaned uploads daily. With `RUN_WORKER_IN_PROCESS=true` it runs inside the web service. To scale web separately, add a second Railway service from the same repo with start command `npm run worker` and set `RUN_WORKER_IN_PROCESS=false` on the web service. Running both at once is safe.

### Scaling notes

The default pool is 10 connections per instance. The PRD sizing (≤50 concurrent users) fits one instance comfortably. Read pages are dynamic, server-rendered and indexed; we have **not** load-tested them, so treat the < 2 s targets as unverified until measured on the real infrastructure.

## 4. Backups, restore, retention

- **Database**: Supabase runs automated daily backups (Pro plan: 7 days; PITR available as an add-on). On the free plan, schedule your own `pg_dump`, e.g. a nightly GitHub Action or Railway cron:
  `pg_dump "$DATABASE_URL" -Fc -f maps-$(date +%F).dump`, stored in a private bucket that only the owner can access.
- **Files**: Storage objects aren't covered by database backups. Mirror the `weekly-resources` bucket nightly (Supabase S3-compatible endpoint plus `rclone sync`) into a private destination.
- **Restore rehearsal** (do this before launch and quarterly): create a scratch Supabase project, `pg_restore -d "$SCRATCH_URL" maps-YYYY-MM-DD.dump`, sync the bucket mirror into it, point a staging Railway service at it, and spot-check a cohort journal and a resource download.
- Proposed objectives: ≤ 24 h data loss, ≤ 4 h restore. **Not yet verified** on the chosen plan; confirm after the first rehearsal.
- Removed resources are hidden (`state = removed`) and their blobs kept, for recovery. Uploads that never completed are removed by the worker after 24 h. No other automatic deletion exists. Platform owners decide retention of obsolete backup copies; delete old dumps and mirrors by hand from the private backup location.

## 5. Rollback

- **App**: Railway → Deployments → pick the previous successful deployment → Redeploy.
- **Schema**: migrations are additive. If a future migration must be reverted, restore the pre-deploy dump into a new database and repoint `DATABASE_URL`. Take a manual `pg_dump` before any deploy that adds a migration.
- The previous GitHub Pages site (if still served from the `gh-pages` branch) stays up until you disable Pages in the repository settings. Keep it until the new deployment is accepted.

## 6. Production smoke checklist

Mark each item passed / failed / not tested, with evidence (see TEST_REPORT.md):

1. `GET /api/health` → `{ ok: true, db: "up" }`.
2. Owner bootstrap link → account created → `/manage/cohorts`.
3. Create a cohort → add a startup → invite a test inbox (on the sandbox allowlist) → Delivery shows "Accepted by provider" → "Delivered" after the webhook arrives.
4. The invited founder sets a password from the email, lands on the startup home, saves a draft, publishes a daily update; the admin sees it in the journal and participation views.
5. Password reset email arrives; the link opens a **Continue** page (scanners can't consume it); the new password works; other sessions are signed out.
6. Upload a PDF to a week and publish → the founder opens it; a signed-out request to `/api/files/<id>` is refused.
7. A mentor publishes availability → the founder books → both receive confirmations → reschedule → both receive old and new details.
