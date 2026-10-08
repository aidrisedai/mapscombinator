"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui/primitives";

export function CohortTabs({ base }: { base: string }) {
  const path = usePathname();
  const items = [
    { key: "home", href: base, label: "Home" },
    { key: "journal", href: `${base}/journal`, label: "Journal" },
    { key: "startups", href: `${base}/startups`, label: "Startups" },
    { key: "weeks", href: `${base}/weeks`, label: "Weekly guide" },
    { key: "mentors", href: `${base}/mentors`, label: "Mentors" },
    { key: "office-hours", href: `${base}/office-hours`, label: "Office hours" },
    { key: "announcements", href: `${base}/announcements`, label: "Announcements" },
  ];
  const rest = path.slice(base.length).split("/")[1] ?? "";
  const current = rest === "" ? "home" : rest === "updates" ? "journal" : rest;
  return <Tabs items={items} current={current} />;
}
