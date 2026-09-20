import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import type { ForcedToolCallParams, LlmClient } from "./types.js";

// Script generation runs on Gemini, called from a Lambda. (Bedrock is not available on this
// AWS account, and the hackathon only requires the project itself to be deployed on AWS.)

// "latest" alias avoids pinning to a dated model name that may not exist by
// the time this runs — confirm against Google AI Studio if behavior seems off.
const DEFAULT_MODEL = "gemini-flash-latest";

function modelId(): string {
  // `||` not `??` — GEMINI_MODEL is commonly left as an empty string in .env
  // rather than unset, and an empty string should also fall back to default.
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY env var is not set");
  return key;
}

export class GeminiClient implements LlmClient {
  async converseWithForcedTool(params: ForcedToolCallParams): Promise<unknown> {
    const ai = new GoogleGenAI({ apiKey: apiKey() });

    const response = await ai.models.generateContent({
      model: modelId(),
      contents: params.userMessage,
      config: {
        systemInstruction: params.system,
        tools: [
          {
            functionDeclarations: [
              {
                name: params.tool.name,
                description: params.tool.description,
                parametersJsonSchema: params.tool.inputSchema,
              },
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: [params.tool.name],
          },
        },
      },
    });

    const call = response.functionCalls?.find((c) => c.name === params.tool.name);
    if (!call?.args) {
      throw new Error("Gemini response did not include the expected function call");
    }
    return call.args;
  }
}
