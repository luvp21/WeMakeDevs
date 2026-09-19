import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { SyncRequestSchema } from "@vaani/shared";
import { ZodError } from "zod";
import { getLockedScript } from "../lib/lockScript.js";
import { computeSync } from "../lib/sync/computeSync.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const parsed = SyncRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const locked = await getLockedScript(parsed.script_id);
    const result = await computeSync(locked);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
    return { statusCode: 409, body: JSON.stringify({ error: (err as Error).message }) };
  }
};
