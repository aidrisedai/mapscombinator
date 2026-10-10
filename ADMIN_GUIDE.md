# Admin guide

Everything below happens in **Manage** (top navigation). Program members never see these controls.

## Using the AI assistant
Most forms have a green **✦ … with AI** button: cohorts, startups, members, weekly guide, office hours, announcements, founder updates, startup profiles, mentor profiles and booking questions. Type or paste what you know, then press **Draft it**. Check the draft, press **Put this in the form**, then review and use the form's usual Save, Publish or Preview button. For startups, paste a whole list and save them all at once; no emails go out until you invite founders from each startup's page. The AI can misread names, emails and dates, so check them before saving. It only leaves fields blank when it doesn't know, and it never overwrites what you've typed with a blank.

## Mentors and advisors
Advisors use the **Mentor / advisor** role: they appear to founders, publish bookable times, and read the published journal (never drafts).

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

## Emails (acceptance, welcome and messages to startups)
Cohort → **Emails**.

**Automatic emails** go out on their own. You can edit the wording for each cohort:
- **Acceptance + invitation (founders):** sent when you invite a founder or cofounder. It congratulates them and includes the **Set up your account** button, so they know to create their account.
- **Welcome (founders):** sent right after a founder sets up their account.
- **Invitation** and **Welcome (mentors & advisors):** the same pair for advisors.

Use placeholders such as `{first_name}`, `{startup_name}`, `{cohort_name}`, `{start_date}` and `{inviter_name}`; the page lists them all. The platform always adds the setup button and expiry note itself, so they can't be removed by mistake. **Preview** shows the email filled in for a real startup, and **Send test to me** emails you a copy. **Reset to standard** goes back to the built-in text. Resending an invitation uses the latest wording.

**Email startups:**
- Choose all startups, pick some, or "startups that haven't posted this week's weekly summary". Optionally add the cohort's mentors, or a copy to yourself.
- Write the subject and message (or use **Write this email with AI**), then press **Preview recipients and email**. You see everyone who will get it and exactly how it looks. Press **Send**.
- Each person gets their own personalised email; nobody sees the other addresses. Replies go to the cohort's support email.
- A startup whose founders haven't set up accounts yet gets the email at its contact address, without a platform button.
- Save messages you reuse as templates. **Sent emails** shows delivery counts; each startup's page lists the emails it was sent; **Delivery** has per-person detail and retries.

## Advisors tab (onboarding advisors)
Cohort → **Advisors**:
- **Invite advisors:** paste one per line (`Name, email`; spreadsheet rows work), press **Preview**, check the list, then **Confirm**. New people get an invitation to set up their account. People who already have an account, for example from an earlier cohort, are added straight away and get a short "you've been added" email. They never sign up twice. Running the same list again doesn't duplicate anything.
- **Add advisors from other cohorts:** tick advisors who already work with your other cohorts and press **Add selected**.
- **The list** shows each advisor's profile status, whether they've published availability, and their upcoming appointments, with links to edit their profile or availability on their behalf, or remove them from this cohort.

What advisors see: the cohort's startups with this week's progress (daily updates, whether the weekly summary is posted, total updates; published only, never drafts), each team's published timeline, the journal, the weekly guide, office hours and announcements. Founders don't see the cross-team progress counts.

## Mentors
Cohort → **Members** → invite with role *Mentor / advisor*. The invitation email tells them they'll set up a profile. After they accept, they land on **Mentor → Profile** with a welcome note and fill in:
- headline, short bio, areas of expertise and interests (the startups or problems they want to help with);
- LinkedIn link (`linkedin.com/in/…` without `https://` is fine) and a calendar link (Calendly, Cal.com, Google booking page);
- optional contact email and phone. These are shown only to founders and the program team in the cohorts that mentor is assigned to, never to other cohorts. The contact email doesn't change their sign-in email.

Mentors can paste their LinkedIn "About" section into **Write your profile with AI** to draft it. Founders see everyone under the cohort's new **Mentors** tab, and the full profile, links and contact details on each mentor's page next to the booking times.

On the Members page, mentors missing a headline, bio, expertise or LinkedIn show a **Profile incomplete** badge. Use **Profile** next to their name to fill it in on their behalf (only the mentor can change their own name); changes are attributed to you. You can manage their availability the same way. One mentor can serve several cohorts with one calendar, and the platform prevents double bookings across cohorts. The platform doesn't read external calendars, so mentors must block time they can't attend.

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
