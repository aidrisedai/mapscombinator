import type { Metadata } from "next";
import { Card, Notice, PageHeader } from "@/components/ui/primitives";
import { profileGaps } from "@/lib/server/domain/mentors";
import { one } from "@/lib/server/page";
import { mentorPage, NotAMentor, OnBehalfBanner } from "../context";
import { ProfileForm } from "./ProfileForm";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { aiConfigured } from "@/lib/server/ai/assistant";

export const metadata: Metadata = { title: "Mentor profile" };

export default async function MentorProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { ctx } = await mentorPage("/mentor/profile", sp);
  if (!ctx) return <NotAMentor />;
  const p = ctx.profile;
  const gaps = profileGaps(p);
  return (
    <>
      <PageHeader title="Profile" description="What founders in your cohorts see when they choose a mentor or advisor." />
      <OnBehalfBanner ctx={ctx} />
      <div className="max-w-2xl">
        {one(sp.welcome) && ctx.self ? (
          <div className="mb-5">
            <Notice tone="success" title={`Welcome to ${ctx.cohorts.map((c) => c.name).join(", ")}`}>
              Start by telling founders about yourself: a headline, your LinkedIn, what you can help with and how to reach you. You can paste your LinkedIn &ldquo;About&rdquo; section into the AI helper to draft it. Then add availability so teams can book you.
            </Notice>
          </div>
        ) : gaps.length > 0 ? (
          <div className="mb-5">
            <Notice tone="info" title="Profile incomplete">
              Still missing: {gaps.join(", ")}. Founders choose mentors from this profile.
            </Notice>
          </div>
        ) : null}
        <Card>
          <>
            <AiAssistant kind="mentorProfile" ctx={{ mentorId: ctx.mentor.id }} target="#ai-target-mentor-profile" configured={aiConfigured()} audience="mentor" title="Write your profile with AI" placeholder="e.g. Paste your LinkedIn headline and About section, or describe your background and the startups you'd like to help" />
            <div id="ai-target-mentor-profile">
              <ProfileForm
              mentorId={ctx.mentor.id}
              self={ctx.self}
              displayName={ctx.mentor.displayName}
              headline={p?.headline ?? ""}
              bio={p?.bio ?? ""}
              interests={p?.interests ?? ""}
              linkedinUrl={p?.linkedin_url ?? ""}
              calendarUrl={p?.calendar_url ?? ""}
              contactEmail={p?.contact_email ?? ""}
              phone={p?.phone ?? ""}
              accountEmail={ctx.mentor.email}
              expertise={((p?.expertise as string[] | undefined) ?? []).join(", ")}
              timezone={p?.timezone ?? "America/Los_Angeles"}
              meetingUrl={p?.meeting_url ?? ""}
              meetingInstructions={p?.meeting_instructions ?? ""}
            />
            </div>
          </>
        </Card>
        <p className="mt-4 text-xs text-ink/60">Assigned cohorts: {ctx.cohorts.map((c) => c.name).join(", ")}.</p>
      </div>
    </>
  );
}
