# MAPS Combinator — website + incubator platform

This repository contains two things, served by one Next.js 16 app:

1. **Public site** (`app/(marketing)`): the planning-stage MAPS Combinator website. Facts and launch-state switches live in `content/site.ts`.
2. **Incubator platform** (`app/(platform)`, `app/(auth)`): invite-only cohorts, startup daily/weekly journals, weekly guides with slides, group office hours, mentor appointments, announcements, and transactional email. It implements the MAPS Platform PRD r2.1.

Stack: Next.js 16 (App Router, Server Actions) · React 19 · Tailwind v4 · Postgres (Supabase in production) · Supabase Auth and private Storage · Resend · Railway. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Local development

Requirements: Node 22+ and a local Postgres 14+ (with the bundled `btree_gist` extension).

```bash
npm install
createdb maps_dev                       # or: psql -c "create database maps_dev"
cp .env.example .env.local              # dev defaults: local auth, local files, email → .data/mail
npm run db:migrate                      # uses DATABASE_URL from your shell (export it, or prefix the command)
APP_URL=http://localhost:3000 DATABASE_URL=postgres://postgres@localhost:5432/maps_dev \
  npm run bootstrap:owner -- --print-link    # prints your single-use owner link
npm run dev                             # http://localhost:3000
```

Open the printed link, set a password, and you're the platform owner. In development, every email the platform would send is written to `.data/mail/` and shown at **http://localhost:3000/dev/mailbox** (development only; 404 elsewhere). Nothing is ever reported as "sent" in this mode.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve (`PORT` respected) |
| `npm run start:prod` | Apply migrations, then serve (used by the Docker image) |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Integration tests against a real Postgres (`TEST_DATABASE_URL`, default `postgres://postgres@localhost:5432/maps_test`; **the schema is dropped and recreated**) |
| `npm run db:migrate` | Apply `db/migrations/*.sql` once each, under an advisory lock |
| `npm run bootstrap:owner [-- --print-link]` | Create the organization (if needed) and a platform-owner invitation for `OWNER_EMAIL` |
| `npm run worker` | Standalone outbox/slot worker (only if `RUN_WORKER_IN_PROCESS=false`) |
| `npm run e2e` | Browser walkthrough against a running local server (see TEST_REPORT.md) |

## How it fits together

```
app/(marketing)/      public site (unchanged content)
app/(auth)/           sign-in, invitation acceptance, reset/confirm pages (+ server actions)
app/(platform)/app/   founder/mentor/viewer views: cohort home, journal, composer, weekly guide, office hours, bookings
app/(platform)/mentor appointments, availability, profile
app/(platform)/manage cohort administration and platform owner tools
app/api/              file download/upload, Resend webhook, exports, health
lib/server/domain/    all business rules — every read/write checks scope here
lib/server/authz.ts   role/scope resolution from the database (never from the browser)
lib/server/email/     templates, Resend adapter, durable outbox
db/migrations/        SQL schema with enforced invariants
tests/                integration tests (Postgres)
```

Key guarantees, enforced in the database where possible:
- One daily update per startup per day, and one weekly summary per program week (unique indexes).
- Optimistic locking with immutable revisions.
- One booking per canonical mentor slot, and no overlapping (buffered) mentor appointments across cohorts or overlapping startup appointments (Postgres exclusion constraints).
- An invitation is consumed exactly once, and only by an account with the invited verified email.
- Emails are queued in the same transaction as the change that triggers them.

## Role walkthroughs

- **Platform owner**: Manage → Create cohort → Members (invite cohort admins) → Startups (add, invite founders) → Weekly guide → Office hours → Activate. Platform settings, owners and account suspension are under Manage → Platform.
- **Cohort admin**: Manage → your cohort. Same tools, scoped to the cohorts you're assigned.
- **Founder**: accept the emailed invitation, set a password, and land on your startup home. Post the daily update (≈1 minute) and the weekly summary, read the cohort journal and weekly guide, and book a mentor under Office hours.
- **Mentor**: accept the invitation. Mentor → Availability (publish windows), Appointments, Profile.
- **Viewer**: read-only access to the published journal, guides and sessions.

See [ADMIN_GUIDE.md](ADMIN_GUIDE.md) for step-by-step admin tasks, [MIGRATION.md](MIGRATION.md) for the fresh-build/import decision, and [TEST_REPORT.md](TEST_REPORT.md) for the acceptance matrix.
