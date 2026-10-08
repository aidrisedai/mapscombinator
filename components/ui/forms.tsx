"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { buttonClass, cx } from "./primitives";

export type Result = { ok: true; data?: unknown } | { ok: false; code?: string; error: string; fieldErrors?: Record<string, string> };
export type FormAction = (fd: FormData) => Promise<Result>;

const FieldErrors = createContext<Record<string, string>>({});
const Dirty = createContext<() => void>(() => {});

export const inputClass =
  "w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20 disabled:bg-cream aria-[invalid=true]:border-error";

/** Warn before leaving with unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
}

/**
 * Submits via a Server Action without React's automatic form reset, so
 * typed input always survives validation/network failures. Success copy is
 * shown only after the server confirms.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  successMessage,
  after = "refresh",
  className,
  submitVariant = "primary",
  warnUnsaved = false,
  footer,
  confirmMessage,
}: {
  action: FormAction;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  successMessage?: string;
  after?: "refresh" | "reset" | "none" | { redirect: string };
  className?: string;
  submitVariant?: "primary" | "secondary" | "danger";
  warnUnsaved?: boolean;
  footer?: ReactNode;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useUnsavedWarning(warnUnsaved && dirty);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    start(async () => {
      let r: Result;
      try {
        r = await action(fd);
      } catch (err) {
        // Redirects thrown by the action propagate; anything else is a network/server failure.
        if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
        r = { ok: false, error: "We couldn't reach the server. Check your connection — your text is still here — and try again." };
      }
      setResult(r);
      if (r.ok) {
        setDirty(false);
        // The server action refreshes the page itself (lib/server/action.ts).
        if (after === "reset") formRef.current?.reset();
        if (typeof after === "object") router.push(after.redirect);
      }
    });
  }

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  return (
    <FieldErrors.Provider value={fieldErrors}>
      <Dirty.Provider value={() => setDirty(true)}>
        <form ref={formRef} onSubmit={submit} onChange={() => setDirty(true)} className={cx("space-y-5", className)} noValidate>
          {children}
          {result && !result.ok && (
            <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
              {result.error}
            </p>
          )}
          {result?.ok && successMessage && (
            <p role="status" className="rounded-md border border-emerald/40 bg-emerald/5 px-3 py-2 text-sm text-success">
              {successMessage}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className={buttonClass(submitVariant)}>
              {pending ? pendingLabel : submitLabel}
            </button>
            {footer}
          </div>
        </form>
      </Dirty.Provider>
    </FieldErrors.Provider>
  );
}

/** Small one-button action (e.g. Resend, Revoke). */
export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  variant = "secondary",
  confirmMessage,
  size = "sm",
}: {
  action: FormAction;
  fields?: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  confirmMessage?: string;
  size?: "sm" | "md";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={buttonClass(variant, size)}
        onClick={() => {
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          const fd = new FormData();
          for (const [k, v] of Object.entries(fields ?? {})) fd.set(k, v);
          start(async () => {
            try {
              const r = await action(fd);
              // On success the server action refreshes the page itself.
              setError(r.ok ? null : r.error);
            } catch (err) {
              if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
              setError("Couldn't reach the server. Try again.");
            }
          });
        }}
      >
        {pending ? (pendingLabel ?? "Working…") : label}
      </button>
      {error && <span role="alert" className="max-w-xs text-xs text-error">{error}</span>}
    </span>
  );
}

export function Field({ label, name, hint, required, optional, children, error: errorProp }: { label: string; name: string; hint?: ReactNode; required?: boolean; optional?: boolean; children: (p: { id: string; describedBy?: string; invalid: boolean }) => ReactNode; error?: string }) {
  const errors = useContext(FieldErrors);
  const error = errorProp ?? errors[name];
  const id = useId();
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
      <div className="mt-1.5">{children({ id, describedBy: [hintId, errId].filter(Boolean).join(" ") || undefined, invalid: Boolean(error) })}</div>
      {error && <p id={errId} className="mt-1 text-sm text-error">{error}</p>}
    </div>
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "id"> & { label: string; name: string; hint?: ReactNode; optional?: boolean; error?: string };

export function TextField({ label, name, hint, optional, required, error, ...rest }: InputProps) {
  return (
    <Field label={label} name={name} hint={hint} required={required} optional={optional} error={error}>
      {({ id, describedBy, invalid }) => <input id={id} name={name} aria-describedby={describedBy} aria-invalid={invalid} required={required} className={inputClass} {...rest} />}
    </Field>
  );
}

export function TextAreaField({ label, name, hint, optional, required, maxLength, defaultValue, rows = 4, value, onValueChange, error, ...rest }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id"> & { label: string; name: string; hint?: ReactNode; optional?: boolean; onValueChange?: (v: string) => void; error?: string }) {
  const [local, setLocal] = useState(String(defaultValue ?? ""));
  const current = value !== undefined ? String(value) : local;
  const over = maxLength !== undefined && current.length > maxLength;
  return (
    <Field label={label} name={name} hint={hint} required={required} optional={optional} error={error}>
      {({ id, describedBy, invalid }) => (
        <>
          <textarea
            id={id}
            name={name}
            rows={rows}
            aria-describedby={describedBy}
            aria-invalid={invalid || over}
            className={cx(inputClass, "resize-y leading-relaxed")}
            value={current}
            onChange={(e) => {
              setLocal(e.target.value);
              onValueChange?.(e.target.value);
            }}
            {...rest}
          />
          {maxLength !== undefined && (
            <p className={cx("mt-1 text-right text-xs", over ? "font-semibold text-error" : "text-ink/50")} aria-live="polite">
              {current.length.toLocaleString()} / {maxLength.toLocaleString()}
            </p>
          )}
        </>
      )}
    </Field>
  );
}

export function SelectField({ label, name, hint, optional, required, options, ...rest }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name" | "id"> & { label: string; name: string; hint?: ReactNode; optional?: boolean; options: { value: string; label: string }[] }) {
  return (
    <Field label={label} name={name} hint={hint} required={required} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <select id={id} name={name} aria-describedby={describedBy} aria-invalid={invalid} className={inputClass} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({ label, name, hint, defaultChecked, value = "on" }: { label: ReactNode; name: string; hint?: ReactNode; defaultChecked?: boolean; value?: string }) {
  const id = useId();
  const errors = useContext(FieldErrors);
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="mt-1 h-4 w-4 rounded border-line accent-forest" />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint && <p className="text-xs text-ink/60">{hint}</p>}
        {errors[name] && <p className="text-sm text-error">{errors[name]}</p>}
      </div>
    </div>
  );
}

export function useMarkDirty() {
  return useContext(Dirty);
}
