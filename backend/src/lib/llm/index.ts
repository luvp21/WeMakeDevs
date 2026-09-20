import type { LlmClient } from "./types.js";
import { GeminiClient } from "./gemini.js";

export type { LlmClient, ToolDefinition } from "./types.js";

// Script generation runs on Gemini. Everything talks to the LlmClient interface (types.ts),
// so another provider could be added here without touching scriptGen.
export function getLlmClient(): LlmClient {
  return new GeminiClient();
}
