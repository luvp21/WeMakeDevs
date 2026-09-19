import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RenderRequestSchema, type RenderStatus } from "@vaani/shared";
import { ZodError } from "zod";
import { triggerRenderTask } from "../lib/render/trigger.js";
import { setRenderStatus } from "../lib/render/status.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const parsed = RenderRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const status: RenderStatus = {
      script_id: parsed.script_id,
      status: "pending",
      updated_at: new Date().toISOString(),
    };
    await setRenderStatus(status);
    await triggerRenderTask(parsed.script_id);
    return { statusCode: 200, body: JSON.stringify(status) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
};
