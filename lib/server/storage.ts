import "server-only";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { supabaseAdmin } from "./auth/supabase";
import { env } from "./env";

/**
 * Private blob storage. Keys are server-generated UUID paths, never
 * user-controlled. Supabase bucket must be PRIVATE (see DEPLOYMENT.md).
 */
export type StoredFile = { bytes: Buffer; contentType: string };

function localPath(key: string) {
  const root = resolve(process.cwd(), env().LOCAL_STORAGE_DIR);
  const p = resolve(root, key);
  if (!p.startsWith(root)) throw new Error("bad storage key");
  return p;
}

export async function putObject(key: string, bytes: Buffer, contentType: string) {
  const e = env();
  if (e.STORAGE_PROVIDER === "local") {
    const p = localPath(key);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, bytes);
    writeFileSync(`${p}.type`, contentType);
    return;
  }
  const { error } = await supabaseAdmin().storage.from(e.SUPABASE_STORAGE_BUCKET).upload(key, bytes, { contentType, upsert: false });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
}

export async function deleteObject(key: string) {
  const e = env();
  if (e.STORAGE_PROVIDER === "local") {
    const p = localPath(key);
    if (existsSync(p)) unlinkSync(p);
    if (existsSync(`${p}.type`)) unlinkSync(`${p}.type`);
    return;
  }
  await supabaseAdmin().storage.from(e.SUPABASE_STORAGE_BUCKET).remove([key]);
}

/** Short-lived URL (Supabase) or bytes (local). Call only after authorization. */
export async function accessObject(key: string, filename: string): Promise<{ url: string } | StoredFile> {
  const e = env();
  if (e.STORAGE_PROVIDER === "local") {
    const p = localPath(key);
    return { bytes: readFileSync(p), contentType: readFileSync(`${p}.type`, "utf8") };
  }
  const { data, error } = await supabaseAdmin().storage.from(e.SUPABASE_STORAGE_BUCKET).createSignedUrl(key, 60, { download: filename });
  if (error || !data) throw new Error(`signed url failed: ${error?.message}`);
  return { url: data.signedUrl };
}

export function localStorageRoot() {
  return join(process.cwd(), env().LOCAL_STORAGE_DIR);
}

// ───────────────────────────── Validation ──────────────────────────────────

export const ALLOWED = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

/** Extension + magic bytes. PDF: "%PDF-". PPTX: ZIP with ppt/ entries. */
export function validateUpload(filename: string, bytes: Buffer, maxBytes: number): { ok: true; ext: keyof typeof ALLOWED } | { ok: false; error: string } {
  const ext = filename.toLowerCase().split(".").pop() as string;
  if (!(ext in ALLOWED)) return { ok: false, error: "Only PDF and PPTX files can be uploaded." };
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > maxBytes) return { ok: false, error: `Files can be at most ${Math.round(maxBytes / 1048576)} MiB.` };
  if (ext === "pdf" && bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, error: "This file isn't a valid PDF." };
  if (ext === "pptx") {
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
    if (!zip || !bytes.includes(Buffer.from("ppt/"))) return { ok: false, error: "This file isn't a valid PowerPoint (.pptx) file." };
    // Macro-enabled content is refused even if renamed to .pptx.
    if (bytes.includes(Buffer.from("vbaProject.bin"))) return { ok: false, error: "Files containing macros aren't allowed." };
  }
  return { ok: true, ext: ext as keyof typeof ALLOWED };
}

export function safeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "file";
}
