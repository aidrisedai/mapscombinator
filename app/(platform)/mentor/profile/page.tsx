import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/primitives";
import { mentorPage, NotAMentor, OnBehalfBanner } from "../context";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Mentor profile" };

export default async function MentorProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ctx } = await mentorPage("/mentor/profile", await searchParams);
  if (!ctx) return <NotAMentor />;
  const p = ctx.profile;
  return (
    <>
      <PageHeader title="Profile" description="What founders see when they choose a mentor." />
      <OnBehalfBanner ctx={ctx} />
      <div className="max-w-2xl">
        <Card>
          <ProfileForm
            mentorId={ctx.mentor.id}
            self={ctx.self}
            displayName={ctx.mentor.displayName}
            bio={p?.bio ?? ""}
            expertise={((p?.expertise as string[] | undefined) ?? []).join(", ")}
            timezone={p?.timezone ?? "America/Los_Angeles"}
            meetingUrl={p?.meeting_url ?? ""}
            meetingInstructions={p?.meeting_instructions ?? ""}
          />
        </Card>
        <p className="mt-4 text-xs text-ink/60">Assigned cohorts: {ctx.cohorts.map((c) => c.name).join(", ")}.</p>
      </div>
    </>
  );
}
