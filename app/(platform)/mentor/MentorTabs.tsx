"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/primitives";

export function MentorTabs() {
  const path = usePathname();
  const sp = useSearchParams();
  const m = sp.get("mentor");
  const q = m ? `?mentor=${encodeURIComponent(m)}` : "";
  const current = path.split("/")[2] || "appointments";
  return (
    <Tabs
      current={current}
      items={[
        { key: "appointments", href: `/mentor/appointments${q}`, label: "Appointments" },
        { key: "availability", href: `/mentor/availability${q}`, label: "Availability" },
        { key: "profile", href: `/mentor/profile${q}`, label: "Profile" },
      ]}
    />
  );
}
