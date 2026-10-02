import "server-only";
import { env } from "../env";
import { localAuth } from "./local";
import { supabaseAuth } from "./supabase";
import type { AuthProvider } from "./types";

export function auth(): AuthProvider {
  return env().AUTH_PROVIDER === "supabase" ? supabaseAuth : localAuth;
}
export { PASSWORD_MIN } from "./types";
