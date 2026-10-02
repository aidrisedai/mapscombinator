import "server-only";
import { z } from "zod";

/**
 * Validated server configuration. Read once; fails fast with a readable list
 * of missing/invalid settings. Never import from client components.
 */
const schema = z
  .object({
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: z.enum(["require", "disable"]).default("disable"),

    AUTH_PROVIDER: z.enum(["supabase", "local"]).default("local"),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

    STORAGE_PROVIDER: z.enum(["supabase", "local"]).default("local"),
    SUPABASE_STORAGE_BUCKET: z.string().default("weekly-resources"),
    LOCAL_STORAGE_DIR: z.string().default(".data/uploads"),

    EMAIL_PROVIDER: z.enum(["resend", "log"]).default("log"),
    RESEND_API_KEY: z.string().optional(),
    RESEND_WEBHOOK_SECRET: z.string().optional(),
    EMAIL_FROM: z.string().default("MAPS Combinator <no-reply@example.invalid>"),
    EMAIL_REPLY_TO: z.string().optional(),
    // Comma-separated. When set, only these recipients are actually sent to;
    // others are recorded as "suppressed" (never as sent).
    EMAIL_SANDBOX_ALLOWLIST: z.string().optional(),

    OWNER_EMAIL: z.string().email().optional(),
    ORGANIZATION_NAME: z.string().default("MAPS Combinator"),
    RUN_WORKER_IN_PROCESS: z.enum(["true", "false"]).default("true"),
    MAX_UPLOAD_MIB: z.coerce.number().int().min(1).max(100).default(20),
  })
  .superRefine((env, ctx) => {
    const prod = env.APP_ENV === "production" || env.APP_ENV === "staging";
    const need = (key: keyof typeof env, why: string) => {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `required ${why}` });
    };
    if (env.AUTH_PROVIDER === "supabase" || env.STORAGE_PROVIDER === "supabase") {
      need("SUPABASE_URL", "for Supabase");
      need("SUPABASE_ANON_KEY", "for Supabase");
      need("SUPABASE_SERVICE_ROLE_KEY", "for Supabase");
    }
    if (env.EMAIL_PROVIDER === "resend") need("RESEND_API_KEY", "when EMAIL_PROVIDER=resend");
    if (prod) {
      if (env.AUTH_PROVIDER !== "supabase")
        ctx.addIssue({ code: "custom", path: ["AUTH_PROVIDER"], message: "must be supabase in staging/production" });
      if (env.STORAGE_PROVIDER !== "supabase")
        ctx.addIssue({ code: "custom", path: ["STORAGE_PROVIDER"], message: "must be supabase in staging/production" });
      if (env.EMAIL_PROVIDER !== "resend")
        ctx.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "must be resend in staging/production" });
      if (!env.APP_URL.startsWith("https://"))
        ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "must be https in staging/production" });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid server configuration:\n${lines.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

export function isProductionLike() {
  const e = env().APP_ENV;
  return e === "production" || e === "staging";
}
