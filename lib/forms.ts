/** Shared by the public forms and the server so options and labels never drift. */
export const CONTRIBUTION_OPTIONS = [
  { value: "Mentor or hold office hours", short: "Mentor / office hours", anchor: "mentor" },
  { value: "Be a customer or pilot partner", short: "Pilot partner", anchor: "pilot-partner" },
  { value: "Volunteer with program operations", short: "Volunteer", anchor: "volunteer" },
  { value: "Sponsor or partner", short: "Sponsor / partner", anchor: "sponsor" },
  { value: "Just send me program updates", short: "Program updates", anchor: "updates" },
] as const;

export const STAGE_OPTIONS = [
  "Researching a problem",
  "Talking to potential users",
  "Building a prototype",
  "Have early users or customers",
  "Team formed, ready for a structured program",
] as const;
