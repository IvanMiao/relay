import { z } from "zod";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS = 3;
export const draftFieldsSchema = z.object({
  requestReference: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/,
      "Use letters, numbers, dashes or underscores.",
    ),
  item: z.string().trim().min(2, "Enter an item description.").max(200),
  vendor: z.string().trim().min(2, "Enter a vendor name.").max(160),
  quantity: z.coerce.number().int().min(1).max(10000),
  currency: z.enum(["USD", "EUR", "GBP"]),
  unitPrice: z.coerce
    .number()
    .positive("Enter a unit price greater than zero.")
    .max(1000000)
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001,
      "Use at most two decimal places.",
    ),
  costCenter: z
    .string()
    .trim()
    .min(2, "A confirmed cost center is required.")
    .max(80),
  justification: z
    .string()
    .trim()
    .min(20, "Add a justification of at least 20 characters.")
    .max(5000),
});

export type DraftFields = z.infer<typeof draftFieldsSchema>;
export type PortalAttachment = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  sha256: string;
  url: string;
};
export type PortalDraft = {
  id: string;
  requestReference: string;
  status: "draft";
  createdAt: string;
  fields: DraftFields;
  attachments: PortalAttachment[];
  url: string;
};
export type UploadInput = {
  name: string;
  contentType: string;
  bytes: Uint8Array;
};
export class PortalError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

export function validateDraft(input: unknown, files: UploadInput[]) {
  const parsed = draftFieldsSchema.safeParse(input);
  if (!parsed.success)
    throw new PortalError(
      422,
      "Check the highlighted fields.",
      parsed.error.flatten().fieldErrors,
    );
  if (files.length < 1 || files.length > MAX_ATTACHMENTS)
    throw new PortalError(
      422,
      "Attach 1–3 supporting files, including your quote.",
    );
  for (const file of files) {
    if (file.bytes.length === 0 || file.bytes.length > MAX_FILE_BYTES)
      throw new PortalError(
        422,
        "Each attachment must be non-empty and no larger than 5 MB.",
      );
    if (!file.name || file.name.length > 160)
      throw new PortalError(422, "Attachment names must be 1–160 characters.");
    if (
      !["application/pdf", "text/plain", "image/png", "image/jpeg"].includes(
        file.contentType,
      )
    ) {
      throw new PortalError(422, "Use PDF, TXT, PNG or JPG attachments.");
    }
  }
  return parsed.data;
}
