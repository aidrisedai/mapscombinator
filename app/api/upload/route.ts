import { NextResponse } from "next/server";
import { uploadFileResource } from "@/lib/server/domain/weeks";
import { errorResponse, assertSameOrigin } from "@/lib/server/http";
import { requireAccount } from "@/lib/server/session";

/** Weekly resource upload (PDF/PPTX). Multipart: cohortId, week, label, file, replacesId?. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const actor = await requireAccount();
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Choose a file to upload." }, { status: 422 });
    const id = await uploadFileResource(
      actor,
      String(fd.get("cohortId") ?? ""),
      Number(fd.get("week")),
      { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) },
      String(fd.get("label") ?? ""),
      (fd.get("replacesId") as string) || null,
    );
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return errorResponse(err);
  }
}
