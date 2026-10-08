"use client";

import { useRef, useState, useTransition } from "react";
import { ActionForm, TextField, type Result } from "@/components/ui/forms";
import { buttonClass } from "@/components/ui/primitives";
import { addExceptionAction } from "../actions";

export function ExceptionForm({ mentorId, timezone, today }: { mentorId: string; timezone: string; today: string }) {
  const [kind, setKind] = useState<"unavailable" | "replacement">("unavailable");
  const [formKey, setFormKey] = useState(0);
  const [needsAck, setNeedsAck] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pendingFd = useRef<FormData | null>(null);

  async function submit(fd: FormData): Promise<Result> {
    setDone(null);
    setNeedsAck(null);
    const r = await addExceptionAction(fd);
    if (!r.ok && r.code === "conflict") {
      pendingFd.current = fd;
      setNeedsAck(r.error);
      return { ok: false, error: "Not saved yet — confirm below." };
    }
    if (r.ok) {
      setDone(r.data.message);
      setKind("unavailable");
      setFormKey((k) => k + 1);
    }
    return r;
  }

  function confirmKeep() {
    const fd = pendingFd.current;
    if (!fd || pending) return;
    fd.set("acknowledgeBookings", "1");
    start(async () => {
      try {
        const r = await addExceptionAction(fd);
        if (!r.ok) {
          setAckError(r.error);
          return;
        }
        setNeedsAck(null);
        setAckError(null);
        pendingFd.current = null;
        setDone(r.data.message);
        setKind("unavailable");
        setFormKey((k) => k + 1);
      } catch {
        setAckError("We couldn't reach the server. Nothing was saved — try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {done && (
        <p role="status" className="rounded-md border border-emerald/40 bg-emerald/5 px-3 py-2 text-sm text-success">{done}</p>
      )}
      <ActionForm key={formKey} action={submit} submitLabel="Add exception" pendingLabel="Saving…" after="refresh" submitVariant="secondary">
        <input type="hidden" name="mentorId" value={mentorId} />
        <input type="hidden" name="acknowledgeBookings" value="0" />
        <div onChange={() => needsAck && setNeedsAck(null)} className="space-y-4">
          <TextField label="Date" name="localDate" type="date" required min={today} defaultValue={today} hint={`A calendar date in ${timezone.replaceAll("_", " ")} (your profile timezone).`} />
          <fieldset>
            <legend className="text-sm font-semibold text-ink">On that date</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="kind" value="unavailable" checked={kind === "unavailable"} onChange={() => setKind("unavailable")} className="accent-forest" /> I&apos;m unavailable all day
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="kind" value="replacement" checked={kind === "replacement"} onChange={() => setKind("replacement")} className="accent-forest" /> Use a different (or shorter) window
              </label>
            </div>
          </fieldset>
          {kind === "replacement" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="From" name="startTime" type="time" required />
              <TextField label="Until" name="endTime" type="time" required />
            </div>
          )}
        </div>
      </ActionForm>
      {needsAck && (
        <div role="alert" className="space-y-3 rounded-md border border-[#f0c987] bg-[#fff8ec] px-4 py-3 text-sm">
          <p>{needsAck}</p>
          {ackError && <p className="text-error">{ackError}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonClass("primary", "sm")} onClick={confirmKeep} disabled={pending}>
              {pending ? "Saving…" : "Confirm — keep those appointments"}
            </button>
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setNeedsAck(null)} disabled={pending}>
              Don&apos;t add the exception
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
