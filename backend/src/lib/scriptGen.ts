import {
  RawScriptOutputSchema,
  type Beat,
  type IngestResult,
  type RawBeat,
  type Scene,
  type Script,
  type VisualSpec,
} from "@vaani/shared";
import { getLlmClient, type ToolDefinition } from "./llm/index.js";
import { HINGLISH_EXAMPLE_LINES } from "./prompts/hinglishExamples.js";

const TOOL_NAME = "emit_script";

// Kept to 5 properties on purpose — Gemini's forced function-calling (mode:
// ANY) rejects object schemas with 8+ properties with a bare 400
// INVALID_ARGUMENT, confirmed empirically. See RawBeatSchema in @vaani/shared.
const EMIT_SCRIPT_TOOL: ToolDefinition = {
  name: TOOL_NAME,
  description: "Emit the generated narration script as scenes and beats.",
  inputSchema: {
    type: "object",
    required: ["scenes"],
    properties: {
      scenes: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: {
          type: "object",
          required: ["title", "beats"],
          properties: {
            title: { type: "string" },
            beats: {
              type: "array",
              minItems: 2,
              maxItems: 5,
              items: {
                type: "object",
                required: ["text", "visual_type"],
                properties: {
                  text: {
                    type: "string",
                    description:
                      "One beat's narration line, natural Hinglish (code-switched Hindi/English), not formal Hindi.",
                  },
                  visual_type: {
                    type: "string",
                    enum: ["code_highlight", "slide", "graph", "ui_demo"],
                  },
                  file_path: {
                    type: "string",
                    description: "Required for code_highlight — must be one of the provided sample file paths.",
                  },
                  line_range: {
                    type: "string",
                    description: "Required for code_highlight. Format: \"start-end\", e.g. \"10-25\".",
                  },
                  content: {
                    type: "string",
                    description:
                      "For slide/graph: a small self-contained HTML snippet for the visual. For ui_demo: a description of what the live demo should show. Unused for code_highlight.",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".rb": "ruby",
  ".php": "php",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".kt": "kotlin",
  ".swift": "swift",
  ".scala": "scala",
};

function languageFromFilePath(filePath: string): string | undefined {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex < 0) return undefined;
  return LANGUAGE_BY_EXTENSION[filePath.slice(dotIndex)];
}

function parseLineRange(lineRange: string | undefined): { start: number; end: number } {
  const match = lineRange?.match(/^(\d+)-(\d+)$/);
  if (!match) return { start: 1, end: 1 };
  return { start: Number(match[1]), end: Number(match[2]) };
}

function buildVisualSpec(raw: RawBeat): VisualSpec {
  switch (raw.visual_type) {
    case "code_highlight": {
      const filePath = raw.file_path ?? "";
      const { start, end } = parseLineRange(raw.line_range);
      return {
        visual_type: "code_highlight",
        file_path: filePath,
        start_line: start,
        end_line: end,
        language: languageFromFilePath(filePath),
      };
    }
    case "slide":
      return { visual_type: "slide", html: raw.content ?? "" };
    case "graph":
      // No separate "what this shows" field to keep the tool schema under
      // Gemini's property-count limit — the beat's own narration text
      // already describes the graph, so reuse it here.
      return { visual_type: "graph", html: raw.content ?? "", description: raw.text };
    case "ui_demo":
      return { visual_type: "ui_demo", note: raw.content ?? "" };
  }
}

function buildSystemPrompt(): string {
  return [
    "You write scene-by-scene narration scripts that explain a codebase out loud, for a short explainer video.",
    "",
    "Register: natural Hinglish — code-switched Hindi/English the way an Indian developer actually explains code to a friend, not formal or translated-sounding Hindi. Match the register of these real example lines:",
    ...HINGLISH_EXAMPLE_LINES.map((line) => `- ${line}`),
    "",
    "Structure: break the explanation into scenes, each scene into beats. A beat is one visual state — one thing on screen while a chunk of narration plays. Every beat needs a visual_type:",
    "- code_highlight: highlighting specific lines in a specific provided source file. Set file_path to one of the given sample file paths, and line_range to the line numbers as \"start-end\" (e.g. \"10-25\"). Leave content empty.",
    "- slide: put a small HTML snippet explaining a concept in content.",
    "- graph: put a small HTML snippet showing a diagram/architecture graph in content.",
    "- ui_demo: put a description of what the live screen-share demo should show in content.",
    "",
    "Design system for slide/graph content (every video shares one consistent visual identity, not each beat improvising its own — this is applied automatically, don't redeclare it):",
    "- Your HTML is placed INSIDE an already-styled dark container (padding, centering, and background are handled for you) — write only inner content (h1/h2/p/div), never a full page, background color, or fixed positioning.",
    "- Use plain semantic tags for automatic styling: <h1> for the main point, <h2> for a secondary label, <p> for body text.",
    "- Available classes: \"accent\" (blue) and \"accent-warm\" (amber) for emphasis spans, \"card\" for a boxed/elevated group, \"mono\" for inline code-like text.",
    "- Prefer real specifics from the repo (an actual function/package/API name, a real number) over generic phrasing — a diagram or label should say something only true of this project, never filler that could describe any codebase.",
    "- Keep it minimal: one clear idea per beat, short text, generous whitespace. No gradients, no decorative icons, no stock illustration style.",
    "",
    "Keep beats short — a beat's text should be roughly one breath of narration, not a paragraph.",
    "Ground code_highlight beats in the actual files provided below; don't invent file paths or line numbers.",
  ].join("\n");
}

function buildUserMessage(ingest: IngestResult, userContext: string): string {
  const parts: string[] = [];
  parts.push(`Repo: ${ingest.repo_url}`);
  parts.push(`What to emphasize (from the user): ${userContext || "(none given — use your judgement)"}`);
  if (ingest.readme) {
    parts.push(`\n--- README ---\n${ingest.readme}`);
  }
  if (ingest.package_files.length > 0) {
    parts.push("\n--- Package/dependency files ---");
    for (const f of ingest.package_files) {
      parts.push(`\n# ${f.path}\n${f.content}`);
    }
  }
  if (ingest.sample_files.length > 0) {
    parts.push("\n--- Sample source files (only use these paths for code_highlight beats) ---");
    for (const f of ingest.sample_files) {
      parts.push(`\n# ${f.path}\n${f.content}`);
    }
  }
  return parts.join("\n");
}

let sceneCounter = 0;
let beatCounter = 0;

function nextSceneId(): string {
  sceneCounter += 1;
  return `scene-${sceneCounter}`;
}

function nextBeatId(): string {
  beatCounter += 1;
  return `beat-${beatCounter}`;
}

export async function generateScript(ingest: IngestResult, userContext: string): Promise<Script> {
  sceneCounter = 0;
  beatCounter = 0;

  const toolInput = await getLlmClient().converseWithForcedTool({
    system: buildSystemPrompt(),
    userMessage: buildUserMessage(ingest, userContext),
    tool: EMIT_SCRIPT_TOOL,
  });
  const raw = RawScriptOutputSchema.parse(toolInput);

  const scenes: Scene[] = raw.scenes.map((rawScene) => {
    const beats: Beat[] = rawScene.beats.map((rawBeat) => ({
      id: nextBeatId(),
      text: rawBeat.text,
      visual_type: rawBeat.visual_type,
      visual_spec: buildVisualSpec(rawBeat),
    }));
    return { id: nextSceneId(), title: rawScene.title, beats };
  });

  return { repo_url: ingest.repo_url, user_context: userContext, scenes };
}
