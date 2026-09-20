import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { guard, HttpError, type Auth, type Guard } from "../lib/auth/access.js";

type Handler = (event: APIGatewayProxyEventV2, auth: Auth) => Promise<APIGatewayProxyStructuredResultV2>;

function parseBody(body: string | undefined): unknown {
  try {
    return body ? JSON.parse(body) : undefined;
  } catch {
    return undefined;
  }
}

export function errorResponse(err: HttpError): APIGatewayProxyStructuredResultV2 {
  return { statusCode: err.status, body: JSON.stringify({ error: err.message }) };
}

// Wraps a route so it only runs for a signed-in account that is allowed to make
// this call (see guard() in lib/auth/access.ts). A quota spent for the call is
// given back if the work then fails on our side.
export function secured(rules: Guard, run: Handler): (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2> {
  return async (event) => {
    let checked: Awaited<ReturnType<typeof guard>>;
    try {
      checked = await guard(event.headers?.authorization, rules, {
        body: parseBody(event.body),
        path: event.pathParameters,
      });
    } catch (err) {
      if (err instanceof HttpError) return errorResponse(err);
      return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
    }

    try {
      const result = await run(event, checked.auth);
      if ((result.statusCode ?? 200) >= 500) await checked.refundQuota();
      return result;
    } catch (err) {
      await checked.refundQuota();
      throw err;
    }
  };
}
