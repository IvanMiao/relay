import { caseStore } from "@/server/cases/store";
import { caseHttp } from "@/server/cases/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return caseHttp(request, () => ({ case: caseStore().get(id).snapshot }));
}
