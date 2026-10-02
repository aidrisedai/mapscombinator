"use client";

import { useState, type ComponentProps } from "react";
import { ActionForm, type FormAction, type Result } from "@/components/ui/forms";

type Props = Omit<ComponentProps<typeof ActionForm>, "action" | "confirmMessage"> & {
  action: FormAction;
  /** Ask for confirmation only when this checkbox is ticked (e.g. "send email"). */
  confirmIfChecked?: { name: string; message: string };
  /** Confirm first (skipped when the confirmIfChecked dialog is shown instead). */
  confirmMessage?: string;
};

/**
 * ActionForm with conditional confirmation and a success message composed
 * by the server (`data.message`), so counts like "12 emails queued" reflect
 * what actually committed.
 */
export function OpForm({ action, confirmIfChecked, confirmMessage, successMessage, children, ...rest }: Props) {
  const [message, setMessage] = useState<string | undefined>(successMessage);
  async function wrapped(fd: FormData): Promise<Result> {
    if (confirmIfChecked && fd.get(confirmIfChecked.name) === "on") {
      if (!window.confirm(confirmIfChecked.message)) return { ok: false, error: "Nothing was changed. Submit again when you're ready, or untick the email option." };
    } else if (confirmMessage && !window.confirm(confirmMessage)) return { ok: false, error: "Nothing was changed." };
    const r = await action(fd);
    if (r.ok) {
      const d = r.data as { message?: unknown } | undefined;
      setMessage(typeof d?.message === "string" ? d.message : successMessage);
    }
    return r;
  }
  return (
    <ActionForm action={wrapped} successMessage={message} {...rest}>
      {children}
    </ActionForm>
  );
}
