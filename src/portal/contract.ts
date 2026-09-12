import type { PortalDraft } from "../lib/contracts";
import type { PortalDraft as StoredDraft } from "./schema";

/** Preserve existing database records while publishing the frozen wire format. */
export function portalRecord(draft: StoredDraft): PortalDraft {
  const { requestReference: _, ...fields } = draft.fields;
  return {
    ...draft,
    fields: { ...fields, unitPrice: fields.unitPrice.toFixed(2) },
    attachments: draft.attachments.map((a) => ({
      id: a.id,
      fileName: a.name,
      mediaType: a.contentType,
      sizeBytes: a.size,
      sha256: a.sha256,
      url: a.url,
    })),
  };
}

export function portalError(
  status: number,
  message: string,
  fields?: Record<string, string[] | undefined>,
) {
  const code =
    (
      {
        400: "invalid_request",
        403: "forbidden",
        404: "not_found",
        409: "idempotency_conflict",
        422: "validation_failed",
      } as Record<number, string>
    )[status] ?? "internal_error";
  return Response.json(
    {
      error: {
        code,
        message,
        ...(fields
          ? {
              fieldErrors: Object.fromEntries(
                Object.entries(fields).map(([key, errors]) => [
                  key,
                  errors?.join(" "),
                ]),
              ),
            }
          : {}),
      },
    },
    { status },
  );
}
