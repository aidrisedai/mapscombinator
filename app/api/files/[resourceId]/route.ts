import { NextResponse } from "next/server";
import { openResource } from "@/lib/server/domain/weeks";
import { errorResponse } from "@/lib/server/http";
import { requireAccount } from "@/lib/server/session";

/** Authorized file access. Readers get only published weeks' files; links are short-lived. */
export async function GET(req: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  try {
    const { resourceId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(resourceId)) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const actor = await requireAccount();
    const url = new URL(req.url);
    const { resource, access, download } = await openResource(actor, resourceId, url.searchParams.get("download") === "1" ? "download" : "auto");
    if ("url" in access) return NextResponse.redirect(access.url, { status: 302, headers: { "Cache-Control": "no-store" } });
    return new NextResponse(new Uint8Array(access.bytes), {
      headers: {
        "Content-Type": resource.content_type,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${String(resource.filename).replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
