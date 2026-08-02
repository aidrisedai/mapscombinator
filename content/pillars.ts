/** The five institutional pillars. Used as both communication structure and
 * program taxonomy across the site. */
export type Pillar = {
  number: string;
  name: string;
  purpose: string;
  copy: string;
};

export const pillars: Pillar[] = [
  {
    number: "01",
    name: "Gather",
    purpose: "Build durable relationships among people who make things.",
    copy: "Founder gatherings, fireside conversations, demo nights, and community events bring Greater Seattle's Muslim builders into the same room. This is the front door: come meet people, share what you are working on, and discover where you can contribute.",
  },
  {
    number: "02",
    name: "Learn",
    purpose: "Develop practical craft and judgment.",
    copy: "Workshops, skill sessions, founder stories, and office hours turn experience into practical help. Topics follow the work: customer discovery, AI and software, hardware prototyping, sales, finance, hiring, responsible innovation, and more.",
  },
  {
    number: "03",
    name: "Build",
    purpose: "Move from conversation to evidence.",
    copy: "Coworking sessions, build weekends, peer accountability, and prototyping support help members turn meaningful problems into tested artifacts. Progress is measured through conversations, experiments, working products, and real use—not presentation polish alone.",
  },
  {
    number: "04",
    name: "Launch",
    purpose: "Give committed early-stage teams a disciplined pathway.",
    copy: "MAPS Combinator is a selective, 12-week, equity-free early-stage incubator. Teams validate a problem, build and test a useful product, strengthen their operating foundation, and prepare for the next appropriate stage.",
  },
  {
    number: "05",
    name: "Return",
    purpose: "Turn individual success into community capacity.",
    copy: "Builders who grow return value through mentorship, internships, sponsorship, introductions, expertise, service, or charitable support. The goal is not a one-way benefit; it is an ecosystem that becomes more capable with every generation.",
  },
];

/** The builder journey, displayed vertically on mobile, horizontally on desktop. */
export const journeySteps = [
  {
    title: "Enter through community",
    copy: "Attend an open event, founder gathering, workshop, or demo night.",
  },
  {
    title: "Show up to the work",
    copy: "Join scheduled coworking, office hours, or a build session. State what you are working on and what evidence you need next.",
  },
  {
    title: "Validate a real problem",
    copy: "Speak with affected people, challenge assumptions, identify a specific customer, and document what was learned.",
  },
  {
    title: "Build and test",
    copy: "Create the smallest useful artifact, place it in front of real users, and improve it based on behavior rather than praise.",
  },
  {
    title: "Enter a focused pathway",
    copy: "Strong teams may apply to MAPS Combinator or an Entrepreneur in Residence pilot when those programs are open.",
  },
  {
    title: "Launch or hand off",
    copy: "Teams clarify their next step: customers, hiring, an accelerator, grants, investment readiness, continued bootstrapping, or a responsible decision to stop.",
  },
  {
    title: "Return value",
    copy: "Alumni mentor, hire, teach, sponsor, connect, volunteer, or strengthen the institutions that helped them build.",
  },
];
