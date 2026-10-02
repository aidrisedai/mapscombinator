# Migration plan — fresh build

**Decision (confirmed by the product owner, 2026-10-02):** this release is a **fresh build**. The earlier `maps-progress` application (Vinext on ChatGPT Sites, D1 storage, ChatGPT sign-in) holds no production data that must be carried over, so no production data is moved.

What this means:
- The old site at `https://maps-startup-journal.v0stuff.chatgpt.site` is **not** updated or redirected by this work. The new platform runs at its own Railway URL / custom domain.
- No ChatGPT identities are linked. Everyone joins the new platform through an emailed invitation and their own password.
- No emails are sent by any migration. Invitations go out only when an administrator confirms them in the UI.

## If old journal data turns up later

The old app offered a JSON export. To import it:

1. Create the destination cohort in the new platform (Manage → Create cohort), labeled e.g. "Legacy cohort (imported)", with the original start date, length and timezone.
2. Enroll the startups (Manage → Startups) **without** sending invitations.
3. Map the export to the new schema:

   | Old concept | New table / field |
   |---|---|
   | team | `startups` + `enrollments` (cohort = legacy cohort) |
   | member (ChatGPT subject) | not imported as a login. Recorded in the audit log as a legacy reference; the person later accepts an invitation with a verified email, and an owner links authorship |
   | daily/weekly update | `team_updates` (kind, report_date / week_number, state, content, first/last published timestamps) |
   | revision history | `update_revisions` (revision number, content, created_at) |
   | weekly text/links | `week_content_revisions` + `week_resources` (kind = link) |

4. Run the import in a transaction against a **copy** first, then compare row counts per table and sample five updates and their revision histories against the export.
5. Preserve original IDs where they're UUIDs. Otherwise keep a mapping table in the import script's output.

Authorship of imported posts needs an account. Create a placeholder "Imported (legacy)" account with no login (`auth_subject` = `legacy:<old-subject>`, state `suspended`) so attribution survives without granting access. Reattribute to a real account only after that person signs in with a verified email and an owner confirms the match. Never match by display name.

No import script ships in this release because no legacy data was provided. Writing one is a small, contained task once an export file exists.

## Rehearsal evidence

Not applicable to a fresh build: no source data exists. Schema creation from scratch is exercised by every test run (`tests/global-setup.ts` drops the schema and applies all migrations), and by `npm run start:prod` on each deploy.
