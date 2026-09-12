import { portalStore } from "@/portal/store";
import {
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  PortalError,
  type UploadInput,
} from "@/portal/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("requestReference");
  if (reference) {
    const draft = portalStore().find(reference);
    return draft
      ? Response.json({ draft })
      : Response.json({ error: "Draft not found." }, { status: 404 });
  }
  return Response.json({ drafts: portalStore().list() });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const publicHost = request.headers.get("host") || new URL(request.url).host;
  // Next's local request URL can use localhost even when the browser uses 127.0.0.1.
  // Compare against the incoming Host rather than that internal URL.
  if (origin) {
    try {
      const source = new URL(origin);
      if (
        source.host !== publicHost ||
        !["http:", "https:"].includes(source.protocol)
      )
        return Response.json(
          { error: "Cross-origin writes are not allowed." },
          { status: 403 },
        );
    } catch {
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }
  }
  try {
    if (
      Number(request.headers.get("content-length")) >
      MAX_ATTACHMENTS * MAX_FILE_BYTES + 65536
    )
      throw new PortalError(413, "Upload is too large.");
    const form = await request.formData();
    const files = form
      .getAll("attachments")
      .filter(
        (value): value is File => value instanceof File && value.size > 0,
      );
    if (
      files.length > MAX_ATTACHMENTS ||
      files.some((file) => file.size > MAX_FILE_BYTES)
    )
      throw new PortalError(422, "Attach up to 3 files, at most 5 MB each.");
    const uploads: UploadInput[] = await Promise.all(
      files.map(async (file) => ({
        name: file.name.replace(/[/\\]/g, "_"),
        contentType: file.type || "application/octet-stream",
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    );
    const input = Object.fromEntries(
      [...form.entries()].filter(([key]) => key !== "attachments"),
    );
    const result = portalStore().create(input, uploads);
    return Response.json(result, { status: result.reused ? 200 : 201 });
  } catch (error) {
    if (error instanceof PortalError)
      return Response.json(
        { error: error.message, fields: error.fields },
        { status: error.status },
      );
    if (error instanceof TypeError)
      return Response.json(
        { error: "Send the draft as multipart form data." },
        { status: 400 },
      );
    console.error("Portal draft save failed:", error);
    return Response.json(
      {
        error:
          "The draft could not be saved. Check existing records before trying again.",
      },
      { status: 500 },
    );
  }
}
