import { NextResponse } from "next/server";
import { exportCohortJson, exportUpdatesCsv } from "@/lib/server/domain/exports";
import { errorResponse } from "@/lib/server/http";
import { requireAccount } from "@/lib/server/session";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "cohort";

export async function GET(req: Request, { params }: { params: Promise<{ cohortId: string }> }) {
  try {
    const { cohortId } = await params;
    const actor = await requireAccount();
    const format = new URL(req.url).searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      const csv = await exportUpdatesCsv(actor, cohortId);
      return new NextResponse(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="updates-${date}.csv"`, "Cache-Control": "no-store" } });
    }
    const { cohortName, data } = await exportCohortJson(actor, cohortId);
    return new NextResponse(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${slug(cohortName)}-${date}.json"`, "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
