"use client";

/** Shared, labeled, accessible field primitives. Labels are always visible —
 * never placeholder-only. */

export function Field({
  label,
  name,
  error,
  required,
  optionalNote,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  optionalNote?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="text-error" aria-hidden="true">
            {" "}
            *
          </span>
        ) : (
          optionalNote && (
            <span className="ml-1 font-normal text-ink/50">({optionalNote})</span>
          )
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-line bg-paper px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:border-emerald";

/** Honeypot spam trap — invisible to people (including assistive tech users),
 * tempting to bots. Creates no accessibility barrier. */
export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="hidden" aria-hidden="true">
      <label htmlFor="company-website">Leave this field empty</label>
      <input
        id="company-website"
        name="company-website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
