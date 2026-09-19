import type { LlmClient } from "./types.js";
import { BedrockClient } from "./bedrock.js";
import { GeminiClient } from "./gemini.js";

export type { LlmClient, ToolDefinition, ForcedToolCallParams } from "./types.js";

// Gemini is the primary provider (Bedrock is optional per the hackathon
// organizers; the AWS requirement is about where we deploy, not the LLM).
// Bedrock stays wired up as an alternative via LLM_PROVIDER=bedrock.
export function getLlmClient(): LlmClient {
  const provider = process.env.LLM_PROVIDER || "gemini";
  switch (provider) {
    case "bedrock":
      return new BedrockClient();
    case "gemini":
      return new GeminiClient();
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
  }
}
