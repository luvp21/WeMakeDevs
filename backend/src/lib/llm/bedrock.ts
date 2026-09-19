import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { DocumentType } from "@smithy/types";
import type { ForcedToolCallParams, LlmClient } from "./types.js";

const client = new BedrockRuntimeClient({});

// Default is a known-good Bedrock model ID. Confirm against the Bedrock
// console for the account/region actually in use (e.g. a newer Claude
// Sonnet may be available as a cross-region inference profile ID) and
// override via BEDROCK_MODEL_ID rather than editing this default.
const DEFAULT_MODEL_ID = "anthropic.claude-3-5-sonnet-20241022-v2:0";

function modelId(): string {
  return process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID;
}

export class BedrockClient implements LlmClient {
  async converseWithForcedTool(params: ForcedToolCallParams): Promise<unknown> {
    const res = await client.send(
      new ConverseCommand({
        modelId: modelId(),
        system: [{ text: params.system }],
        messages: [{ role: "user", content: [{ text: params.userMessage }] }],
        toolConfig: {
          tools: [
            {
              toolSpec: {
                name: params.tool.name,
                description: params.tool.description,
                inputSchema: { json: params.tool.inputSchema as DocumentType },
              },
            },
          ],
          toolChoice: { tool: { name: params.tool.name } },
        },
      }),
    );

    const content = res.output?.message?.content ?? [];
    const toolUse = content.find((block) => "toolUse" in block)?.toolUse;
    if (!toolUse) {
      throw new Error("Bedrock response did not include the expected tool call");
    }
    return toolUse.input;
  }
}
