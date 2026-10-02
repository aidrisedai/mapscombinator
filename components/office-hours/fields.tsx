"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui/primitives";

/** Character counter for controlled inputs. */
export function Counter({ n, max }: { n: number; max: number }) {
  return (
    <p className={cx("mt-1 text-right text-xs", n > max ? "font-semibold text-error" : "text-ink/50")} aria-live="polite">
      {n.toLocaleString()} / {max.toLocaleString()}
    </p>
  );
}

export function Labeled({
  id,
  label,
  hint,
  error,
  required,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: (p: { id: string; name: string; "aria-describedby"?: string; "aria-invalid": boolean; required?: boolean }) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-error" aria-hidden="true"> *</span>}
        {optional && <span className="ml-1 font-normal text-ink/50">(optional)</span>}
      </label>
      {hint && <p id={hintId} className="mt-0.5 text-xs text-ink/60">{hint}</p>}
      <div className="mt-1.5">{children({ id, name: id, "aria-describedby": [hintId, errId].filter(Boolean).join(" ") || undefined, "aria-invalid": Boolean(error), required })}</div>
      {error && <p id={errId} className="mt-1 text-sm text-error">{error}</p>}
    </div>
  );
}
