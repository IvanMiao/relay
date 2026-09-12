import { caseStore } from "@/server/cases/store";
import { controlCase } from "@/server/cases/service";
import { caseHttp } from "@/server/cases/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return caseHttp(request, (body) => ({
    case: controlCase(caseStore(), id, body).snapshot,
  }));
}
