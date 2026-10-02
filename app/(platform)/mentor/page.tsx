import { redirect } from "next/navigation";
import { one } from "@/lib/server/page";

export default async function MentorHome({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const m = one((await searchParams).mentor);
  redirect(`/mentor/appointments${m ? `?mentor=${encodeURIComponent(m)}` : ""}`);
}
