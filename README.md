# MAPS Combinator — Website

Planning-stage website for **MAPS Combinator**, a selective, 12-week,
equity-free early-stage incubator being developed at MAPS in Greater Seattle.

This site carries messaging for the Combinator program only. Messaging for the
broader MAPS Center for Entrepreneurship & Innovation is owned by a separate
team and is intentionally not represented here.

Built with Next.js (App Router), TypeScript, and Tailwind CSS. Statically
exported and deployed to GitHub Pages via GitHub Actions on every push.

## Editing content (no code changes needed)

All facts, statuses, and launch-state switches live in `content/site.ts`:

- Launch stage: `planning` → `approved` → `live`
- Program status: `Planned` / `Interest List` / `Open` / `Waitlist` / `Closed`
- Opening applications: `combinatorApplicationsOpen: true` + `combinatorApplicationUrl`
- MAPS relationship wording: `isFormalMapsInitiative`
- Contact email and optional form endpoint

**Ground rules baked into the site:** nothing unverified renders as public
proof; confirmed benefits are separated from conditional ones; no promises of
funding, credits, or guaranteed outcomes; required disclaimers stay attached
to the program description.

## Forms

Two focused forms: the founder interest list (homepage) and the contributor
form for mentors, pilot partners, volunteers, and sponsors (Get Involved).
Both validate client-side and submit to `siteConfig.formEndpoint` when set
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

`.github/workflows/deploy.yml` builds the static export and publishes it to
the `gh-pages` branch, which GitHub Pages serves. The base path is injected
automatically for `*.github.io/<repo>` hosting; remove `NEXT_PUBLIC_BASE_PATH`
handling when moving to a custom domain.

## Before formal launch

- Confirm program approval, naming rights, cohort dates, and selection owner.
- Replace `app/privacy` and `app/terms` placeholder copy after legal review.
- Confirm the public contact email in `content/site.ts`.
- Wire `formEndpoint` to a proper form backend with server-side validation
  and rate limiting.
