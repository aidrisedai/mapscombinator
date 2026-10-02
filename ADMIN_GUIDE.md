# Admin guide

Everything below happens in **Manage** (top navigation). Program members never see these controls.

## Create a cohort (owners)
Manage → Cohorts → **Create cohort**. Enter the name, Week 1 start date, length (default 12 weeks), timezone and support email, then check the generated week dates. The cohort starts as a **draft**: members can sign in and look around, but posting and booking stay closed. When everything is ready, open the cohort's Overview and press **Activate**.

Dates, length and timezone can change until the first team update is saved. After that they're locked so reporting dates stay correct. Week titles and content stay editable.

## Assign cohort administrators (owners)
Cohort → **Members** → Invite → role *Administrator*. Admins manage only the cohorts they're assigned to.

## Add a startup and invite founders
Cohort → **Startups** → fill in the name, short description, primary contact and optional cofounders.
- **Save startup**: no email is sent.
- **Save and invite primary contact**: you'll see the exact recipient, role and message, then **Confirm and send**.

Invite additional founders from the startup's page (each founder gets their own login; prefer named addresses over shared mailboxes). Resend gives the person a fresh link, and the old link stops working. Revoke takes effect immediately.

Invitation status means what it says: *Queued* → *Sent (delivery not yet confirmed)* → *Delivered* or *Bounced/Delivery failed*. *Not sent (sandbox/test mode)* means the email system is in test mode. Watch everything on **Delivery**, where you can retry failed messages.

## Publish a week
Cohort → **Weekly guide** → choose a week. Write the title, objective, expected work and deliverable, then **Save draft** (nothing is shown or sent). Add links or upload PDF/PPTX slides (up to 5 files, 20 MiB each). **Preview as founder** shows what founders will see. **Publish** makes it visible. Tick *Send email to cohort* only if you want an email to go out; you'll see the recipient count first. Edits to a published week are saved as drafts until you publish again, and founders see "Updated <date>".

## Office hours
Cohort → **Office hours** → **Add session**. For a weekly series, tick *Repeat weekly* and set the number of occurrences. The preview lists every date, keeping the same local time across daylight-saving changes. Sessions are created as drafts. **Publish** one session or the whole series, optionally emailing the cohort.

To change one date, edit it with *This occurrence*. To change all remaining dates, choose *This and future occurrences*; past sessions are never changed. **Cancel** keeps the session visible as cancelled, and offers a cancellation email (pre-checked if that session was emailed before).

## Mentors
Cohort → **Members** → invite with role *Mentor*. After they accept, mentors set their own profile and availability under **Mentor**. From the Members list you can also manage a mentor's availability on their behalf; changes are attributed to you. One mentor can serve several cohorts with one calendar, and the platform prevents double bookings across cohorts. The platform doesn't read external calendars, so mentors must block time they can't attend.

## Bookings and cancellations
Cohort → **Bookings**: set the allowed durations, booking horizon, cancellation window and per-startup limit. Changes apply to new bookings only. The list shows every appointment. Open one to cancel or reschedule it with a reason, which overrides the founder window and is recorded in the audit log. Mentors and founders get the cancellation/reschedule emails automatically.

## Announcements
Cohort → **Announcements** → write, optionally pin, set an expiry, link a week/session → **Publish** (email copy optional).

## Revoke access
- Remove a founder: their startup page → Members → **Remove**. It takes effect on their very next click, and their past posts stay attributed.
- Remove a mentor: Members → **Remove**. If they have upcoming appointments, cancel those first (the system won't leave orphaned meetings).
- Withdraw a startup: its page → **Withdraw** (resolve upcoming appointments first).
- Suspend an account entirely (owners): Manage → Platform → Accounts.

## Moderation
Open any published update → **Hide from cohort journal**, with a reason. The founders' text is never edited; they see that it was hidden and why.

## Export
Cohort Overview → **Export JSON** (lossless, for archiving and migration) or **Export CSV** (updates only; spreadsheet-safe). Owners can export everything under Manage → Platform.

## End of program
Overview → **Complete**: the cohort becomes read-only for founders and history is kept. Owners can **Archive**, and **Restore** an archive with a recorded reason.
