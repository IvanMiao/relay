import { portalRecord, portalError } from "@/portal/contract";
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
    return Response.json({ draft: draft ? portalRecord(draft) : null });
  }
  return Response.json({ drafts: portalStore().list().map(portalRecord) });
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
        return portalError(403, "Cross-origin writes are not allowed.");
    } catch {
      return portalError(403, "Invalid request origin.");
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
    let input: unknown;
    if (form.has("payload")) {
      let payload;
      try {
        payload = JSON.parse(String(form.get("payload")));
      } catch {
        return portalError(400, "The payload must be valid JSON.");
      }
      if (
        !payload?.fields ||
        typeof payload.fields.unitPrice !== "string" ||
        !/^\d+(\.\d{1,2})?$/.test(payload.fields.unitPrice)
      )
        return portalError(422, "Use a decimal string for unitPrice.", {
          unitPrice: ["Use a decimal amount with up to two fractional digits."],
        });
      input = { ...payload.fields, requestReference: payload.requestReference };
    } else {
      input = Object.fromEntries(
        [...form.entries()].filter(([key]) => key !== "attachments"),
      );
    }
    const result = portalStore().create(input, uploads);
    return Response.json(
      { ...result, draft: portalRecord(result.draft) },
      { status: result.reused ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof PortalError)
      return portalError(
        error.status,
        error.message,
        error.fields ||
          (error.status === 422 ? { attachments: [error.message] } : undefined),
      );
    if (error instanceof TypeError)
      return portalError(400, "Send the draft as multipart form data.");
    console.error("Portal draft save failed:", error);
    return portalError(
      500,
      "The draft could not be saved. Check existing records before trying again.",
    );
  }
}
