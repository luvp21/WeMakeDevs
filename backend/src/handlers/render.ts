import { secured } from "./secure.js";
import { RenderRequestSchema, type RenderStatus } from "@vaani/shared";
import { ZodError } from "zod";
import { triggerRenderTask } from "../lib/render/trigger.js";
import { setRenderStatus } from "../lib/render/status.js";

export const handler = secured({ script: "body", quota: "renders" }, async (event, auth) => {
  try {
    const parsed = RenderRequestSchema.parse(JSON.parse(event.body ?? "{}"));
    const status: RenderStatus = {
      script_id: parsed.script_id,
      status: "pending",
      updated_at: new Date().toISOString(),
    };
    await setRenderStatus(status);
    await triggerRenderTask(parsed.script_id, { owner: auth.username, role: auth.role });
    return { statusCode: 200, body: JSON.stringify(status) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
});
