"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { LocalTime } from "@/components/office-hours/LocalTime";
import { SlotPicker } from "@/components/office-hours/SlotPicker";
import type { SlotView } from "@/components/office-hours/slots";
import { Counter, Labeled } from "@/components/office-hours/fields";
import { inputClass, useUnsavedWarning } from "@/components/ui/forms";
import { buttonClass, cx } from "@/components/ui/primitives";
import { bookSlotAction } from "./actions";


type Team = { enrollmentId: string; startupName: string };
type Step = "pick" | "details" | "review";
type Errors = Record<string, string>;

const TOPIC_MAX = 200;
const HELP_MAX = 2000;

function validate(v: { topic: string; helpNeeded: string; link: string; enrollmentId: string }): Errors {
  const e: Errors = {};
  if (!v.enrollmentId) e.enrollmentId = "Choose which startup this appointment is for.";
  if (!v.topic.trim()) e.topic = "Topic is required.";
  else if (v.topic.trim().length > TOPIC_MAX) e.topic = `Topic must be ${TOPIC_MAX} characters or fewer.`;
  if (v.helpNeeded.trim().length > HELP_MAX) e.helpNeeded = `Keep this to ${HELP_MAX.toLocaleString()} characters or fewer.`;
  const link = v.link.trim();
  if (link) {
    try {
      const u = new URL(link);
      if (u.protocol !== "https:" || !u.hostname.includes(".")) e.link = "Use a full https:// link.";
    } catch {
      e.link = "Use a full https:// link.";
    }
  }
  return e;
}

export function BookingFlow({
  cohortId,
  cohortName,
  mentorName,
  slots,
  teams,
  policyText,
  meetingInstructions,
}: {
  cohortId: string;
  cohortName: string;
  mentorName: string;
  slots: SlotView[];
  teams: Team[];
  policyText: string;
  meetingInstructions: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<Step>("pick");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enrollmentId, setEnrollmentId] = useState(teams.length === 1 ? teams[0].enrollmentId : "");
  const [topic, setTopic] = useState("");
  const [helpNeeded, setHelpNeeded] = useState("");
  const [link, setLink] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<{ tone: "error" | "warn"; text: string } | null>(null);
  // One idempotency key per booking attempt (slot + details); reused on retries and double clicks.
  const keyRef = useRef<string | null>(null);
  useUnsavedWarning(Boolean(topic.trim() || helpNeeded.trim()) && !pending);

  const slot = slots.find((s) => s.id === selectedId) ?? null;
  const current: Step = step !== "pick" && !slot ? "pick" : step;
  const team = teams.find((t) => t.enrollmentId === enrollmentId);

  function choose(id: string) {
    if (id !== selectedId) keyRef.current = null;
    setSelectedId(id);
    setBanner(null);
  }

  function toReview() {
    const e = validate({ topic, helpNeeded, link, enrollmentId });
    setErrors(e);
    if (Object.keys(e).length === 0) setStep("review");
  }

  function confirm() {
    if (pending || !slot) return;
    keyRef.current ??= crypto.randomUUID();
    const fd = new FormData();
    fd.set("cohortId", cohortId);
    fd.set("enrollmentId", enrollmentId);
    fd.set("slotId", slot.id);
    fd.set("idempotencyKey", keyRef.current);
    fd.set("topic", topic.trim());
    fd.set("helpNeeded", helpNeeded.trim());
    fd.set("link", link.trim());
    start(async () => {
      let r: Awaited<ReturnType<typeof bookSlotAction>>;
      try {
        r = await bookSlotAction(fd);
      } catch (err) {
        if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
        setBanner({ tone: "error", text: "We couldn't reach the server, so nothing was booked yet. Your details are still here — try again." });
        return;
      }
      if (r.ok) return; // The action redirects to the appointment page.
      if (r.slotTaken) {
        keyRef.current = null;
        setSelectedId(null);
        setStep("pick");
        setBanner({ tone: "warn", text: r.error });
        router.refresh(); // Reload the current open times.
        return;
      }
      if (r.fieldErrors && Object.keys(r.fieldErrors).length) {
        setErrors(r.fieldErrors);
        setStep("details");
      }
      setBanner({ tone: "error", text: r.error });
    });
  }

  const stepLabel = { pick: 1, details: 2, review: 3 }[current];

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-semibold uppercase tracking-wide" aria-label="Booking steps">
        {["Choose a time", "Your question", "Review and confirm"].map((l, i) => (
          <li key={l} className={i + 1 === stepLabel ? "text-forest" : "text-ink/40"} aria-current={i + 1 === stepLabel ? "step" : undefined}>
            {i + 1}. {l}
          </li>
        ))}
      </ol>

      {banner && (
        <p role="alert" className={cx("rounded-md border px-3 py-2 text-sm", banner.tone === "error" ? "border-error/40 bg-error/5 text-error" : "border-[#f0c987] bg-[#fff8ec] text-ink")}>
          {banner.text}
        </p>
      )}

      {current === "pick" && (
        <div className="space-y-5">
          {slots.length === 0 ? (
            <p className="rounded-md border border-dashed border-line bg-cream/40 px-4 py-6 text-center text-sm text-ink/70">
              {mentorName} has no open times right now. Check back later, or pick another mentor.
            </p>
          ) : (
            <SlotPicker slots={slots} selectedId={selectedId} onSelect={choose} />
          )}
          <button type="button" disabled={!slot} onClick={() => setStep("details")} className={buttonClass("primary")}>
            Continue
          </button>
        </div>
      )}

      {current === "details" && slot && (
        <form
          noValidate
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            toReview();
          }}
        >
          <p className="rounded-md bg-cream/60 px-3 py-2 text-sm">
            <span className="font-semibold">{slot.label}</span> with {mentorName}{" "}
            <button type="button" className="ml-1 font-medium text-emerald underline underline-offset-2 hover:text-forest" onClick={() => setStep("pick")}>
              Change time
            </button>
          </p>
          {teams.length > 1 ? (
            <Labeled id="bk-team" label="Startup" required error={errors.enrollmentId} hint="You're a founder of more than one startup in this cohort.">
              {(p) => (
                <select {...p} value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} className={inputClass}>
                  <option value="">Choose a startup…</option>
                  {teams.map((t) => (
                    <option key={t.enrollmentId} value={t.enrollmentId}>
                      {t.startupName}
                    </option>
                  ))}
                </select>
              )}
            </Labeled>
          ) : (
            <p className="text-sm text-ink/70">
              Booking for <strong>{teams[0]?.startupName}</strong> in {cohortName}.
            </p>
          )}
          <Labeled id="bk-topic" label="Topic" required error={errors.topic} hint="One line the mentor can scan, e.g. “Pricing our pilot for clinics”.">
            {(p) => (
              <>
                <input {...p} name="topic" value={topic} onChange={(e) => setTopic(e.target.value)} className={inputClass} autoComplete="off" />
                <Counter n={topic.length} max={TOPIC_MAX} />
              </>
            )}
          </Labeled>
          <Labeled id="bk-help" label="What help do you need?" optional error={errors.helpNeeded} hint="Context, what you've tried, and the decision you're facing. Only your team, the mentor and administrators see this — it isn't posted to the journal.">
            {(p) => (
              <>
                <textarea {...p} name="helpNeeded" rows={5} value={helpNeeded} onChange={(e) => setHelpNeeded(e.target.value)} className={cx(inputClass, "resize-y leading-relaxed")} />
                <Counter n={helpNeeded.length} max={HELP_MAX} />
              </>
            )}
          </Labeled>
          <Labeled id="bk-link" label="Relevant link" optional error={errors.link} hint="A deck, doc or demo the mentor can open. Must start with https://">
            {(p) => <input {...p} type="url" inputMode="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} />}
          </Labeled>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={buttonClass("primary")}>Review booking</button>
            <button type="button" className={buttonClass("ghost")} onClick={() => setStep("pick")}>Back</button>
          </div>
        </form>
      )}

      {current === "review" && slot && (
        <div className="space-y-5">
          <div className="rounded-lg border border-line bg-cream/40 p-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
              <dt className="font-medium text-ink/60">Mentor</dt>
              <dd>{mentorName}</dd>
              <dt className="font-medium text-ink/60">When</dt>
              <dd>
                <span className="font-semibold">{slot.label}</span>
                <LocalTime start={slot.startsAt} end={slot.endsAt} zone={slot.timezone} />
              </dd>
              <dt className="font-medium text-ink/60">Duration</dt>
              <dd>{slot.minutes} minutes</dd>
              <dt className="font-medium text-ink/60">Where</dt>
              <dd>
                {[slot.online ? "Online — the meeting link appears on your appointment page" : null, slot.location].filter(Boolean).join(" · ") ||
                  "Your mentor will share meeting details on the appointment page."}
                {meetingInstructions && <span className="mt-1 block whitespace-pre-line text-ink/70">{meetingInstructions}</span>}
              </dd>
              <dt className="font-medium text-ink/60">Startup</dt>
              <dd>
                {team?.startupName} · {cohortName}
              </dd>
              <dt className="font-medium text-ink/60">Topic</dt>
              <dd className="break-words">{topic.trim()}</dd>
              {helpNeeded.trim() && (
                <>
                  <dt className="font-medium text-ink/60">Help needed</dt>
                  <dd className="whitespace-pre-line break-words">{helpNeeded.trim()}</dd>
                </>
              )}
              {link.trim() && (
                <>
                  <dt className="font-medium text-ink/60">Link</dt>
                  <dd className="break-all">{link.trim()}</dd>
                </>
              )}
              <dt className="font-medium text-ink/60">Cancellation</dt>
              <dd>{policyText}</dd>
            </dl>
          </div>
          <p className="text-xs text-ink/60">The booking is confirmed only when you see the appointment page. Your mentor and you each get a confirmation email.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={confirm} disabled={pending} className={buttonClass("primary")}>
              {pending ? "Booking…" : "Confirm booking"}
            </button>
            <button type="button" disabled={pending} className={buttonClass("secondary")} onClick={() => setStep("details")}>
              Edit details
            </button>
            <button type="button" disabled={pending} className={buttonClass("ghost")} onClick={() => setStep("pick")}>
              Choose another time
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
