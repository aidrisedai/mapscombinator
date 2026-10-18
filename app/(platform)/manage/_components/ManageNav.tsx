"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui/primitives";

/** Top-level Manage sections; cohort pages have their own tabs underneath. */
export function ManageNav({ isOwner, newSubmissions }: { isOwner: boolean; newSubmissions: number }) {
  const path = usePathname();
  const items = [
    { key: "cohorts", href: "/manage/cohorts", label: "Cohorts" },
    { key: "advisors", href: "/manage/advisors", label: "Advisors" },
    ...(isOwner
      ? [
          { key: "submissions", href: "/manage/submissions", label: `Website submissions${newSubmissions ? ` (${newSubmissions})` : ""}` },
          { key: "platform", href: "/manage/platform", label: "Platform settings" },
        ]
      : []),
  ];
  const seg = path.split("/")[2] ?? "cohorts";
  return <Tabs items={items} current={seg || "cohorts"} />;
}
