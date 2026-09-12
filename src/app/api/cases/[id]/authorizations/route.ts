import { caseStore } from "@/server/cases/store";
import { authorizeCase } from "@/server/cases/service";
import { caseHttp } from "@/server/cases/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return caseHttp(request, (body) => ({
    case: authorizeCase(caseStore(), id, body).snapshot,
  }));
}
