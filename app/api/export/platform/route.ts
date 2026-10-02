import { NextResponse } from "next/server";
import { exportPlatformJson } from "@/lib/server/domain/exports";
import { errorResponse } from "@/lib/server/http";
import { requireAccount } from "@/lib/server/session";

export async function GET() {
  try {
    const data = await exportPlatformJson(await requireAccount());
    return new NextResponse(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="maps-platform-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
