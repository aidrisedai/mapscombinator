# MAPS Center for Entrepreneurship & Innovation — Website

Planning-stage website for the **MAPS Center for Entrepreneurship & Innovation**,
a home for Muslim builders in Greater Seattle, and its flagship program,
**MAPS Combinator**.

Built with Next.js (App Router), TypeScript, and Tailwind CSS. Statically
exported and deployed to GitHub Pages via GitHub Actions on every push.

## Editing content (no code changes needed)

All facts, statuses, and launch-state switches live in `content/`:

| File | What it controls |
|---|---|
| `content/site.ts` | **The truth controls.** Launch stage (`planning` → `approved` → `live`), MAPS relationship, contact email, Combinator status, which sections (events, Built Here, EIR) are enabled, and the optional form endpoint. |
| `content/programs.ts` | The program catalog and each program's public status. |
| `content/events.ts` | Verified events. Adding events + setting `eventsEnabled: true` surfaces the calendar. |
| `content/ventures.ts` | Verified "Built Here" profiles (requires founder permission; directory opens at 2+ profiles). |
| `content/people.ts` | Verified public people (team, speakers, mentors). |
| `content/pillars.ts` | The five pillars and builder journey copy. |

**Ground rules baked into the site:** nothing unverified renders as public
proof; statuses use only the approved labels (Open, Waitlist, Pilot, Interest
List, Planned, Coming Later, Completed); empty states are honest; no promises
of funding, credits, 24/7 access, or guaranteed outcomes.

## Forms

Forms validate client-side and submit to `siteConfig.formEndpoint` when set
(use a vetted form service or your own API). Until then they fall back to
composing a structured email draft to `siteConfig.contactEmail`, so no
submission is silently lost. See `lib/submit.ts`.

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static export to ./out
npm run lint
```

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every
push. The base path is injected automatically for `*.github.io/<repo>` hosting;
remove `NEXT_PUBLIC_BASE_PATH` handling when moving to a custom domain.

## Before formal launch (from the master brief)

- Confirm board approval, naming rights, governance, and program leads.
- Replace `app/privacy` and `app/terms` placeholder copy after legal review.
- Confirm the public contact email in `content/site.ts`.
- Add real, permission-cleared photography.
- Wire `formEndpoint` to a proper form backend with server-side validation
  and rate limiting.
