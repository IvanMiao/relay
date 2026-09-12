import { caseStore } from "@/server/cases/store";
import { json } from "@/server/cases/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const artifact = caseStore().artifact((await context.params).id);
  if (!artifact)
    return json(
      { error: { code: "not_found", message: "Artifact not found." } },
      404,
    );
  return new Response(new Uint8Array(artifact.bytes), {
    headers: {
      "Content-Type": artifact.ref.mediaType,
      "Content-Disposition":
        "inline; filename*=UTF-8''" + encodeURIComponent(artifact.ref.fileName),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
