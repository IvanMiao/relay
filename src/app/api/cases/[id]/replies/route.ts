import { caseStore } from "@/server/cases/store";
import { replyCase } from "@/server/cases/service";
import { caseHttp } from "@/server/cases/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return caseHttp(request, (body) => ({
    case: replyCase(caseStore(), id, body).snapshot,
  }));
}
