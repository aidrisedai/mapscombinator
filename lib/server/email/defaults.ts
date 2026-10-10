/**
 * Built-in wording for the automatic emails. Admins can replace any of these
 * per cohort under Manage → Emails; the platform always adds the required
 * parts (the secure setup button and expiry note) itself.
 */
export type AutoKind = "acceptance" | "founder_welcome" | "mentor_invitation" | "mentor_welcome";

export const AUTO_EMAILS: Record<AutoKind, { title: string; when: string; added: string; subject: string; body: string }> = {
  acceptance: {
    title: "Acceptance + invitation (founders)",
    when: "Sent when you invite a startup's founder or cofounder.",
    added: "The platform adds a “Set up your account” button, who the invitation is for and when it expires.",
    subject: "Congratulations! {startup_name} is accepted into {cohort_name}",
    body: `Hi {first_name},

Congratulations! {startup_name} has been accepted into {cohort_name} at {program_name}. We're excited to work with you.

The program starts on {start_date}. Everything happens on our program platform:
- the weekly guide and resources
- your short daily updates and weekly summary
- office hours and one-to-one time with mentors

Your first step is to set up your account with the button below. It takes about a minute.

Welcome aboard,
{inviter_name}`,
  },
  founder_welcome: {
    title: "Welcome (founders)",
    when: "Sent right after a founder finishes setting up their account.",
    added: "The platform adds an “Open the platform” button.",
    subject: "Welcome to {cohort_name}, {first_name}",
    body: `Hi {first_name},

Your account is ready. Welcome to {cohort_name}!

A good way to start:
- Read this week's guide
- Post a short daily update about what moved forward
- Browse the mentors and book time when you need help

If you have questions, just reply to this email.

{program_name}`,
  },
  mentor_invitation: {
    title: "Invitation (mentors & advisors)",
    when: "Sent when you invite a new mentor or advisor.",
    added: "The platform adds a “Set up your account” button, who the invitation is for and when it expires.",
    subject: "You're invited to mentor startups in {cohort_name}",
    body: `Hi {first_name},

{inviter_name} invited you to join {cohort_name} at {program_name} as a mentor / advisor.

After you set your password, you'll add a short profile (headline, LinkedIn, what you can help with and how to reach you) so founders can get to know you. Then you can follow the startups' progress and publish times they can book.

Thank you for supporting our founders!`,
  },
  mentor_welcome: {
    title: "Welcome (mentors & advisors)",
    when: "Sent right after a mentor or advisor finishes setting up their account.",
    added: "The platform adds an “Open your profile” button.",
    subject: "Welcome to {cohort_name}, {first_name}",
    body: `Hi {first_name},

Thanks for joining {cohort_name} as a mentor / advisor.

Next steps:
- Complete your profile so founders know how you can help
- Publish a few times founders can book
- Look through the startups and their latest updates

{program_name}`,
  },
};

export const AUTO_KINDS = Object.keys(AUTO_EMAILS) as AutoKind[];
