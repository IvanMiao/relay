import { portalStore } from "@/portal/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const file = portalStore().attachment((await params).id);
  if (!file)
    return Response.json({ error: "Attachment not found." }, { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition":
        "attachment; filename*=UTF-8''" + encodeURIComponent(file.name),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
