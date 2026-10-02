import "server-only";
import type { z } from "zod";
import { invalid } from "../errors";
import { fieldErrors } from "@/lib/validation";

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw invalid("Please fix the highlighted fields.", fieldErrors(r.error));
  return r.data;
}
