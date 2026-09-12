import { portalRecord, portalError } from "@/portal/contract";
import { portalStore } from "@/portal/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const draft = portalStore().get((await params).id);
  return draft
    ? Response.json({ draft: portalRecord(draft) })
    : portalError(404, "Draft not found.");
}
