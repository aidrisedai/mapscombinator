"use client";

import { useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/forms";

export type HostOption = { id: string; name: string; roles: string[] };
export type WeekOption = { number: number; label: string };
export type SessionDefaults = {
  title?: string;
  hostAccountId?: string;
  hostName?: string;
  date?: string;
  startTime?: string;
  durationMinutes?: number;
  mode?: string;
  meetingUrl?: string;
  location?: string;
  description?: string;
  preparation?: string;
  weekNumber?: number;
};

/** Shared session detail fields for create and edit. */
export function SessionFields({ hosts, weeks, defaults = {}, timezone }: { hosts: HostOption[]; weeks: WeekOption[]; defaults?: SessionDefaults; timezone: string }) {
  const [host, setHost] = useState(defaults.hostAccountId ?? "");
  const [mode, setMode] = useState(defaults.mode ?? "online");
  return (
    <>
      <TextField label="Title" name="title" required maxLength={160} defaultValue={defaults.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Host"
          name="hostAccountId"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          hint="A mentor host's appointment availability is blocked during the session."
          options={[{ value: "", label: "Someone else (type a name)" }, ...hosts.map((h) => ({ value: h.id, label: `${h.name} (${h.roles.join(", ")})` }))]}
        />
        {host === "" && <TextField label="Host name" name="hostName" maxLength={120} optional defaultValue={defaults.hostName} hint="Shown to founders." />}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Date" name="date" type="date" required defaultValue={defaults.date} />
        <TextField label="Start time" name="startTime" type="time" required defaultValue={defaults.startTime} hint={`${timezone.replaceAll("_", " ")} time`} />
        <TextField label="Duration (minutes)" name="durationMinutes" type="number" min={5} max={480} step={5} required defaultValue={String(defaults.durationMinutes ?? 60)} />
      </div>
      <SelectField
        label="Format"
        name="mode"
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        options={[
          { value: "online", label: "Online" },
          { value: "in_person", label: "In person" },
          { value: "hybrid", label: "Hybrid (online and in person)" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {mode !== "in_person" && <TextField label="Meeting link" name="meetingUrl" type="url" required placeholder="https://" defaultValue={defaults.meetingUrl} />}
        {mode !== "online" && <TextField label="Location" name="location" required maxLength={300} defaultValue={defaults.location} />}
      </div>
      <TextAreaField label="Description" name="description" optional maxLength={4000} rows={4} defaultValue={defaults.description} />
      <TextAreaField label="How to prepare" name="preparation" optional maxLength={2000} rows={3} defaultValue={defaults.preparation} hint="Shown to founders and included in session emails." />
      <SelectField
        label="Related week"
        name="weekNumber"
        defaultValue={String(defaults.weekNumber ?? 0)}
        optional
        options={[{ value: "0", label: "Automatic (the week the date falls in)" }, ...weeks.map((w) => ({ value: String(w.number), label: w.label }))]}
      />
    </>
  );
}
