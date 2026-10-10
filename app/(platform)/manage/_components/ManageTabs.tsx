"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui/primitives";

export function ManageTabs({ base }: { base: string }) {
  const path = usePathname();
  const items = [
    { key: "overview", href: base, label: "Overview" },
    { key: "startups", href: `${base}/startups`, label: "Startups" },
    { key: "advisors", href: `${base}/advisors`, label: "Advisors" },
    { key: "members", href: `${base}/members`, label: "Members" },
    { key: "weeks", href: `${base}/weeks`, label: "Weekly guide" },
    { key: "office-hours", href: `${base}/office-hours`, label: "Office hours" },
    { key: "announcements", href: `${base}/announcements`, label: "Announcements" },
    { key: "emails", href: `${base}/emails`, label: "Emails" },
    { key: "bookings", href: `${base}/bookings`, label: "Bookings" },
    { key: "delivery", href: `${base}/delivery`, label: "Delivery" },
    { key: "settings", href: `${base}/settings`, label: "Settings" },
  ];
  const rest = path.startsWith(base) ? (path.slice(base.length).split("/")[1] ?? "") : "";
  return <Tabs items={items} current={rest === "" ? "overview" : rest} />;
}
