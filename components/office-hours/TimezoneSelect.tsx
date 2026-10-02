"use client";

import { useSyncExternalStore } from "react";
import { SelectField } from "@/components/ui/forms";

let cached: string[] | null = null;
function browserZones() {
  if (!cached) {
    try {
      cached = Intl.supportedValuesOf("timeZone");
    } catch {
      cached = [];
    }
    if (!cached.includes("UTC")) cached = [...cached, "UTC"];
  }
  return cached;
}
const EMPTY: string[] = [];
const noop = () => () => {};

/** IANA timezone picker. The full list comes from the browser after hydration; the current value is always present. */
export function TimezoneSelect({ name, label, defaultValue, hint }: { name: string; label: string; defaultValue: string; hint?: string }) {
  const zones = useSyncExternalStore(noop, browserZones, () => EMPTY);
  const list = zones.includes(defaultValue) ? zones : [defaultValue, ...zones];
  return <SelectField label={label} name={name} hint={hint} defaultValue={defaultValue} options={list.map((z) => ({ value: z, label: z.replaceAll("_", " ") }))} required />;
}
