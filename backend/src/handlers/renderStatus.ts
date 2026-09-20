import { secured } from "./secure.js";
import { getRenderStatus } from "../lib/render/status.js";

export const handler = secured({ script: "path" }, async (event) => {
  try {
    const scriptId = event.pathParameters?.scriptId;
    if (!scriptId) {
      return { statusCode: 400, body: JSON.stringify({ error: "scriptId is required" }) };
    }
    const status = await getRenderStatus(scriptId);
    return { statusCode: 200, body: JSON.stringify(status) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
});
