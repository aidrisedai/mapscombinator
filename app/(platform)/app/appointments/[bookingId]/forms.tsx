"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Labeled } from "@/components/office-hours/fields";
import { OpForm } from "@/components/office-hours/OpForm";
import { SlotPicker } from "@/components/office-hours/SlotPicker";
import type { SlotView } from "@/components/office-hours/slots";
import { TextAreaField } from "@/components/ui/forms";
import { buttonClass, cx } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/forms";
import { cancelBookingAction, rescheduleBookingAction } from "./actions";

export function CancelBookingForm({ bookingId, reasonRequired, hint }: { bookingId: string; reasonRequired: boolean; hint: string }) {
  return (
    <OpForm
      action={cancelBookingAction}
      submitLabel="Cancel appointment"
      pendingLabel="Cancelling…"
      submitVariant="danger"
      confirmMessage="Cancel this appointment? The team and the mentor will be emailed."
      after="refresh"
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <TextAreaField label="Reason" name="reason" rows={3} maxLength={500} required={reasonRequired} optional={!reasonRequired} hint={hint} />
    </OpForm>
  );
}

export function RescheduleForm({ bookingId, slots, reasonRequired }: { bookingId: string; slots: SlotView[]; reasonRequired: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | undefined>();
  const keyRef = useRef<string | null>(null);
  const slot = slots.find((s) => s.id === selectedId) ?? null;

  if (slots.length === 0)
    return <p className="text-sm text-ink/70">This mentor has no other open times right now. You can keep this appointment, or cancel it and book again later.</p>;

  function submit() {
    if (pending || !slot) return;
    if (reasonRequired && !reason.trim()) {
      setReasonError("Record the reason for this change.");
      return;
    }
    setReasonError(undefined);
    if (!window.confirm(`Move this appointment to ${slot.label}? The current time is released only if the new one is secured.`)) return;
    keyRef.current ??= crypto.randomUUID();
    const fd = new FormData();
    fd.set("bookingId", bookingId);
    fd.set("slotId", slot.id);
    fd.set("idempotencyKey", keyRef.current);
    fd.set("reason", reason.trim());
    start(async () => {
      let r: Awaited<ReturnType<typeof rescheduleBookingAction>>;
      try {
        r = await rescheduleBookingAction(fd);
      } catch (err) {
        if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
        setError("We couldn't reach the server. Your appointment hasn't changed — try again.");
        return;
      }
      if (r.ok) return;
      if (r.slotTaken) {
        keyRef.current = null;
        setSelectedId(null);
        router.refresh();
        setError("That time was just taken. Your current appointment is unchanged — pick another time.");
        return;
      }
      if (r.fieldErrors?.reason) setReasonError(r.fieldErrors.reason);
      setError(r.error);
    });
  }

  return (
    <div className="space-y-5">
      <SlotPicker
        name="reschedule-slot"
        slots={slots}
        selectedId={selectedId}
        onSelect={(id) => {
          if (id !== selectedId) keyRef.current = null;
          setSelectedId(id);
          setError(null);
        }}
      />
      <Labeled
        id="resched-reason"
        label="Reason"
        required={reasonRequired}
        optional={!reasonRequired}
        error={reasonError}
        hint={reasonRequired ? "Recorded in the appointment history and shown to the team and mentor." : "Shared with the mentor."}
      >
        {(p) => <textarea {...p} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={cx(inputClass, "resize-y")} />}
      </Labeled>
      {error && (
        <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <button type="button" onClick={submit} disabled={!slot || pending} className={buttonClass("primary")}>
        {pending ? "Rescheduling…" : slot ? "Move to this time" : "Choose a new time"}
      </button>
    </div>
  );
}
