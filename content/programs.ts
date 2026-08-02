import type { Program } from "./types";

/**
 * Program catalog with honest, verifiable statuses.
 *
 * To change a program's status (e.g. coworking becomes real), edit its
 * `status`, `nextDate`, and CTA here. Allowed statuses:
 * Open · Waitlist · Pilot · Interest List · Planned · Coming Later · Completed
 */
export const programs: Program[] = [
  {
    id: "gatherings",
    name: "Community Gatherings",
    purpose:
      "Open founder conversations, firesides, demo nights, and gatherings that help builders meet peers, learn from practitioners, and find useful ways to contribute.",
    audience: "Everyone — builders, mentors, and curious community members",
    format: "In-person gatherings and firesides",
    timeCommitment: "An evening at a time",
    cost: "Free unless otherwise announced",
    location: "Greater Seattle",
    status: "Planned",
    nextDate: "To be announced",
    cta: { label: "View Events", href: "/events" },
    pillar: "01 Gather",
  },
  {
    id: "coworking",
    name: "Builder Coworking",
    purpose:
      "Scheduled work sessions for people actively building. Members state the result they need, work alongside peers, and leave with a documented next action.",
    audience: "Active builders and early-stage founders",
    format: "Scheduled in-person work sessions",
    timeCommitment: "Recurring sessions, a few hours each",
    cost: "Free during the pilot phase",
    location: "Greater Seattle",
    status: "Interest List",
    nextDate: "To be announced",
    cta: {
      label: "Join the Coworking Interest List",
      href: "/get-involved#join",
    },
    pillar: "03 Build",
  },
  {
    id: "workshops",
    name: "Workshops and Office Hours",
    purpose:
      "Practical sessions led by builders and specialists. Topics follow current needs: customer discovery, prototyping, AI, sales, pricing, operations, legal basics, finance, and responsible innovation.",
    audience: "Builders developing a specific skill or decision",
    format: "Workshops and 1:1 office hours",
    timeCommitment: "1–2 hours per session",
    cost: "Free unless otherwise announced",
    location: "Greater Seattle or online",
    status: "Planned",
    nextDate: "To be announced",
    cta: {
      label: "Suggest a Topic or Offer Office Hours",
      href: "/get-involved#mentor",
    },
    pillar: "02 Learn",
  },
  {
    id: "build-weekends",
    name: "Build Weekends",
    purpose:
      "Time-bounded working sessions where participants investigate a real problem, talk to users, build a small artifact, test an assumption, and present what they learned.",
    audience: "Builders ready to work through a full weekend",
    format: "Weekend-long working sessions",
    timeCommitment: "One weekend",
    cost: "To be announced",
    location: "Greater Seattle",
    status: "Planned",
    nextDate: "To be announced",
    cta: { label: "Get Launch Updates", href: "/get-involved#join" },
    pillar: "03 Build",
  },
  {
    id: "eir",
    name: "Entrepreneurs in Residence",
    purpose:
      "A small number of active founders may build publicly from the center, hold office hours, share monthly progress, mentor emerging builders, and create opportunities for others to contribute.",
    audience: "Active founders willing to build in public and help others",
    format: "Residency with public office hours",
    timeCommitment: "Ongoing, defined before selection",
    cost: "To be announced",
    location: "Greater Seattle",
    status: "Coming Later",
    nextDate: "To be announced",
    cta: { label: "Express EIR Interest", href: "/get-involved#eir" },
    pillar: "05 Return",
  },
  {
    id: "combinator",
    name: "MAPS Combinator",
    purpose:
      "A selective, 12-week, equity-free early-stage incubator for teams ready to validate a meaningful problem, build and test a useful product, and prepare for the right next stage.",
    audience: "Committed early-stage teams with evidence of action",
    format: "12-week structured cohort",
    timeCommitment: "Meaningful weekly commitment, published before applications open",
    cost: "To be announced",
    location: "Greater Seattle",
    status: "Interest List",
    nextDate: "To be announced",
    cta: { label: "Explore MAPS Combinator", href: "/programs/combinator" },
    pillar: "04 Launch",
  },
  {
    id: "maker-access",
    name: "Prototyping and Maker Access",
    purpose:
      "The center may begin through partnerships with existing university and community makerspaces, scheduled hardware workshops, and access to shared prototyping resources.",
    audience: "Builders working on physical products",
    format: "Partner makerspaces and scheduled workshops",
    timeCommitment: "Session-based",
    cost: "To be announced",
    location: "Partner facilities",
    status: "Coming Later",
    nextDate: "To be announced",
    cta: { label: "Get Launch Updates", href: "/get-involved#join" },
    pillar: "03 Build",
  },
];
