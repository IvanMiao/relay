import { caseStore } from "@/server/cases/store";
import { createCase } from "@/server/cases/service";
import { caseHttp, json, requireAgent } from "@/server/cases/http";
import { seedContext } from "@/server/cases/context";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const store = caseStore();
  return json({
    cases: store.list(),
    quote: seedContext(store).quote,
    workerReady: store.workerReady(),
  });
}
export async function POST(request: Request) {
  let reused = false;
  const response = await caseHttp(request, (body) => {
    requireAgent();
    const result = createCase(caseStore(), body);
    reused = result.reused;
    return { case: result.record.snapshot };
  });
  if (response.status === 200 && !reused)
    return new Response(response.body, {
      status: 201,
      headers: response.headers,
    });
  return response;
}
