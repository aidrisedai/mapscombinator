"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/primitives";
import { retireRuleAction } from "../actions";

export function RetireRule({ mentorId, ruleId }: { mentorId: string; ruleId: string }) {
  const [pending, start] = useTransition();
  const [conflict, setConflict] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(ack: boolean) {
    if (!ack && !window.confirm("Retire this availability? Open times stop being offered right away.")) return;
    const fd = new FormData();
    fd.set("mentorId", mentorId);
    fd.set("ruleId", ruleId);
    fd.set("acknowledgeBookings", ack ? "1" : "0");
    start(async () => {
      try {
        const r = await retireRuleAction(fd);
        if (r.ok) {
          setConflict(null);
          setError(null);
                  } else if (r.code === "conflict" && !ack) setConflict(r.error);
        else setError(r.error);
      } catch {
        setError("Couldn't reach the server. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      {!conflict && (
        <button type="button" className={buttonClass("danger", "sm")} disabled={pending} onClick={() => run(false)}>
          {pending ? "Retiring…" : "Retire"}
        </button>
      )}
      {conflict && (
        <div role="alert" className="space-y-2 rounded-md border border-[#f0c987] bg-[#fff8ec] px-3 py-2 text-sm">
          <p>{conflict}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass("primary", "sm")} disabled={pending} onClick={() => run(true)}>
              {pending ? "Retiring…" : "Confirm — keep those appointments"}
            </button>
            <button type="button" className={buttonClass("ghost", "sm")} disabled={pending} onClick={() => setConflict(null)}>
              Keep this availability
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
    </div>
  );
}
