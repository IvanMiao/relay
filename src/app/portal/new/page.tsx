import { randomUUID } from "node:crypto";
import { PortalForm } from "@/components/portal-form";
export const dynamic = "force-dynamic";
export default async function NewDraft({
  searchParams,
}: {
  searchParams: Promise<{ requestReference?: string }>;
}) {
  const { requestReference } = await searchParams;
  return (
    <PortalForm
      reference={
        requestReference || "REQ-" + randomUUID().slice(0, 8).toUpperCase()
      }
    />
  );
}
