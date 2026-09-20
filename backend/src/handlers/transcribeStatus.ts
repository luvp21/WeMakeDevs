import { secured } from "./secure.js";
import { getTranscriptionStatus } from "../lib/transcribe/index.js";

export const handler = secured({ script: "path" }, async (event) => {
  try {
    const scriptId = event.pathParameters?.scriptId;
    const sceneId = event.pathParameters?.sceneId;
    if (!scriptId || !sceneId) {
      return { statusCode: 400, body: JSON.stringify({ error: "scriptId and sceneId are required" }) };
    }
    const status = await getTranscriptionStatus(scriptId, sceneId);
    return { statusCode: 200, body: JSON.stringify(status) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) };
  }
});
