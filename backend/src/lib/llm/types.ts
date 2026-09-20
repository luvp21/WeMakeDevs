// The interface script generation talks to. Gemini implements it (gemini.ts), and a different
// provider could be added behind getLlmClient() without touching scriptGen.ts.

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object; // JSON Schema
}

export interface ForcedToolCallParams {
  system: string;
  userMessage: string;
  tool: ToolDefinition;
}

export interface LlmClient {
  // Forces the model to call `tool` and returns its parsed arguments as
  // unknown — untrusted external data, the caller must validate it (e.g.
  // with a Zod schema) before treating it as typed.
  converseWithForcedTool(params: ForcedToolCallParams): Promise<unknown>;
}
