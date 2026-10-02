import "server-only";
import { notFound, redirect } from "next/navigation";
import { AppError } from "./errors";

/** Page data loader: access failures render the generic not-found page (no existence oracle). */
export async function load<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) {
      if (err.code === "not_found" || err.code === "forbidden") notFound();
      if (err.code === "unauthenticated") redirect("/sign-in");
    }
    throw err;
  }
}

export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
