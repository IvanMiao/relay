import { ZodError } from "zod";
import { caseStore, CaseError } from "./store";

export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function caseHttp(
  request: Request,
  operation: (body: unknown) => unknown,
) {
  try {
    if (request.method !== "GET") {
      const origin = request.headers.get("origin"),
        host = request.headers.get("host");
      if (
        origin &&
        (new URL(origin).host !== host ||
          !["http:", "https:"].includes(new URL(origin).protocol))
      )
        throw new CaseError(
          403,
          "forbidden",
          "Cross-origin case changes are not allowed.",
        );
      if (Number(request.headers.get("content-length")) > 20000)
        throw new CaseError(
          400,
          "invalid_request",
          "Request body is too large.",
        );
    }
    const body = request.method === "GET" ? undefined : await request.json();
    return json(operation(body));
  } catch (e) {
    if (e instanceof ZodError)
      return json(
        {
          error: {
            code: "validation_failed",
            message: "Check the request fields.",
            fieldErrors: Object.fromEntries(
              Object.entries(e.flatten().fieldErrors).map(([key, values]) => [
                key,
                Array.isArray(values) ? values.join(" ") : String(values),
              ]),
            ),
          },
        },
        422,
      );
    const error = e as CaseError;
    // Structural check also works across Next development module reloads.
    if (Number.isInteger(error.status) && error.code)
      return json(
        {
          error: {
            code: error.code,
            message: error.message,
            currentVersion: error.currentVersion,
          },
        },
        error.status,
      );
    if (e instanceof SyntaxError || e instanceof TypeError)
      return json(
        { error: { code: "invalid_request", message: "Send valid JSON." } },
        400,
      );
    return json(
      {
        error: {
          code: "internal_error",
          message:
            "The request could not be processed. Your saved state is preserved.",
        },
      },
      500,
    );
  }
}
export function requireAgent() {
  if (!process.env.OPENAI_API_KEY?.trim())
    throw new CaseError(
      503,
      "internal_error",
      "Configure the server API key before starting a live request.",
    );
  if (!caseStore().workerReady())
    throw new CaseError(
      503,
      "internal_error",
      "The Relay worker is not running. Start the app with npm run dev.",
    );
}
