import {
  ChartSpecSchema,
  DiagramSpecSchema,
  RawBeatSchema,
  ScriptPlanResponseSchema,
  VIDEO_FORMATS,
  WORDS_PER_MINUTE,
  DEFAULT_SCRIPT_LANGUAGE,
  SCRIPT_LANGUAGES,
  countWords,
  escapeHtml,
  minutesLabel,
  wordBudget,
  type Beat,
  type IngestResult,
  type RawBeat,
  type PlannedScene,
  type Scene,
  type SceneGenResponse,
  type ScriptLanguage,
  type VideoFormatId,
  type VisualSpec,
} from "@vaani/shared";
import { z } from "zod";
import { getLlmClient, type ToolDefinition } from "./llm/index.js";
import { HINGLISH_EXAMPLE_LINES } from "./prompts/hinglishExamples.js";
import { ENGLISH_EXAMPLE_LINES } from "./prompts/englishExamples.js";
import { cleanNarration, machineWritingHits, spokenStyleRules } from "./prompts/spokenStyle.js";

// Kept to 5 properties on purpose — Gemini's forced function-calling (mode:
// ANY) rejects object schemas with 8+ properties with a bare 400
// INVALID_ARGUMENT, confirmed empirically. See RawBeatSchema in @vaani/shared.
const BEAT_ITEM_SCHEMA = {
  type: "object",
  required: ["text", "visual_type"],
  properties: {
    text: {
      type: "string",
      description: "One beat's narration line, in the language and register the system prompt asks for. Latin letters only.",
    },
    visual_type: {
      type: "string",
      enum: ["code_highlight", "slide", "diagram", "chart", "ui_demo"],
    },
    file_path: {
      type: "string",
      description: "Required for code_highlight — must be one of the provided sample file paths.",
    },
    line_range: {
      type: "string",
      description: 'Required for code_highlight. Format: "start-end", e.g. "10-25".',
    },
    content: {
      type: "string",
      description:
        'slide: an HTML snippet (inner content only). diagram: a JSON string {"title":..., "nodes":[{"id","label","detail"?,"emphasis"?}], "edges":[{"from","to","label"?}]}. chart: a JSON string {"title","unit","points":[{"label","value"}],"source"}. ui_demo: one plain sentence saying what the viewer should see on screen. Unused for code_highlight.',
    },
  },
};

// Planning is a flat list, so unlike the old whole-script call it has no
// nested-array size problem with Gemini (nesting scenes x beats past 8 x 5 made
// it reject the schema outright).
const EMIT_OUTLINE_TOOL: ToolDefinition = {
  name: "emit_outline",
  description: "Emit the outline of the video: one entry per scene.",
  inputSchema: {
    type: "object",
    required: ["scenes"],
    properties: {
      scenes: {
        type: "array",
        minItems: 3,
        maxItems: 14,
        items: {
          type: "object",
          required: ["title", "purpose", "target_words"],
          properties: {
            title: { type: "string", description: "Short scene title." },
            purpose: {
              type: "string",
              description:
                "What this scene must cover, in one or two sentences, naming the specific things from the repo it should use (real files, functions, behavior). Include which visual kinds suit it (for example: a diagram of the flow, two code beats, a live demo).",
            },
            target_words: { type: "integer", description: "Narration length for this scene in words." },
          },
        },
      },
    },
  },
};

const EMIT_SCENE_TOOL: ToolDefinition = {
  name: "emit_scene",
  description: "Emit one scene as a title and its beats.",
  inputSchema: {
    type: "object",
    required: ["title", "beats"],
    properties: {
      title: { type: "string" },
      beats: { type: "array", minItems: 1, maxItems: 6, items: BEAT_ITEM_SCHEMA },
    },
  },
};

const RawSceneOutputSchema = z.object({
  title: z.string(),
  beats: z.array(RawBeatSchema).min(1),
});

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

function fallbackSlide(text: string): VisualSpec {
  const short = text.length > 90 ? `${text.slice(0, 87)}...` : text;
  return { visual_type: "slide", html: `<h1>${escapeHtml(short)}</h1>` };
}

// The model returns diagram/chart data as a JSON string in `content` (the tool
// schema is capped at a few properties, see the note above). It is untrusted
// like any model output: parsed, validated against the real schema, and
// replaced with a plain slide of the narration if it isn't usable, so a bad
// diagram never breaks the script.
function parseStructuredVisual(raw: RawBeat): VisualSpec {
  try {
    const data: unknown = JSON.parse(raw.content ?? "");
    const parsed =
      raw.visual_type === "diagram"
        ? DiagramSpecSchema.safeParse({ ...(data as object), visual_type: "diagram" })
        : ChartSpecSchema.safeParse({ ...(data as object), visual_type: "chart" });
    if (parsed.success) return parsed.data;
    console.warn(`scriptGen: invalid ${raw.visual_type} spec, using a slide instead: ${parsed.error.message.slice(0, 200)}`);
  } catch {
    console.warn(`scriptGen: ${raw.visual_type} content wasn't valid JSON, using a slide instead`);
  }
  return fallbackSlide(raw.text);
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
    case "diagram":
    case "chart":
      return parseStructuredVisual(raw);
    case "ui_demo":
      return { visual_type: "ui_demo", note: raw.content ?? "" };
  }
}

// ------------------------------------------------------------- prompts

interface GenerationOptions {
  targetMinutes?: number;
  sourceScript?: string;
}

// The narration's language and register. Both are Latin letters only, so the
// teleprompter, transcript matching and sync behave the same for either.
export function registerLines(language: ScriptLanguage): string[] {
  if (language === "en") {
    return [
      "Language: English only, no Hindi words. Register: conversational and clear, the way a developer talks a viewer through their own project, not formal or brochure-like. Keep it easy to say aloud for someone whose first language may not be English: short sentences, plain words, technical terms kept as they are. Match the register of these example lines:",
      ...ENGLISH_EXAMPLE_LINES.map((line) => `- ${line}`),
    ];
  }
  return [
    "Register: natural Hinglish, code-switched Hindi/English the way an Indian developer actually talks, not formal or translated-sounding Hindi. Write in Latin letters only (never Devanagari). Keep English technical terms in English. Match the register of these real example lines:",
    ...HINGLISH_EXAMPLE_LINES.map((line) => `- ${line}`),
  ];
}

const VISUAL_RULES = [
  "Structure: scenes contain beats. A beat is one visual state: one thing on screen while a chunk of narration plays. Every beat needs a visual_type:",
  "- slide: an HTML snippet in content (rules below). Use it for statements, benefits, comparisons and titles.",
  "- diagram: an architecture or flow diagram as JSON in content. 3 to 7 nodes, short labels (28 characters max), short edge labels that are verbs. Mark the one most important node with \"emphasis\": true. Only include components that really exist in this repo. Never draw a generic 'frontend, backend, database' picture unless that is literally what the repo is.",
  "- chart: a bar chart as JSON in content. ONLY use numbers that appear in the README, package files or the user's notes, and put where they came from in \"source\". If the material has no real numbers, do not use a chart. Never invent metrics, benchmarks, user counts or percentages.",
  "- code_highlight: highlight specific lines of a provided source file. Set file_path to one of the given sample file paths and line_range to \"start-end\" (e.g. \"10-25\"). Keep content empty. Never invent paths or line numbers.",
  "- ui_demo: the presenter shows the running product. In content, write one plain sentence describing exactly what the viewer should see (for example: \"Paste a GitHub URL and click Draft the script\").",
  "",
  "Slide HTML rules (every video shares one visual identity, in a dark or light theme the presenter picks, applied automatically):",
  "- Your HTML goes INSIDE an already-styled container: write only inner content, never a full page, <style>, colors, fonts or fixed positioning. Never hardcode colors; use only the classes below so the slide works in both themes.",
  "- <h1> for the main point, <h2> for a small label above it, <p> for body text. Class \"statement\" on a <p> makes one very large line, ideal for a hook or a closing line. Classes \"accent\" and \"accent-warm\" for emphasis, \"card\" for a boxed group, \"mono\" for inline code.",
  "- Make slides informative, not just titles. Pick the block that fits the content:",
  "  - Bullets: <ul class=\"points\"><li><b>Name</b> <span>what it does</span></li>...</ul>. 3 to 5 items, each under 12 words. Bold the key term with <b>.",
  "  - Table: <table class=\"data\"><thead><tr><th>Option</th><th>Good for</th></tr></thead><tbody><tr><td>Name</td><td>Value</td></tr>...</tbody></table>. At most 5 rows and 4 columns, a few words per cell. Put numbers in <td class=\"num\">. Use it for comparisons, options, config, API surface.",
  "  - Stat cards: <div class=\"stats\"><div class=\"stat\"><b>3</b><span>what it counts</span></div>...</div>. 2 to 4 cards. Only numbers that appear in the repo material or the user's notes.",
  "  - Two columns: <div class=\"cols\"><div class=\"card\"><h3>Before</h3><ul class=\"points\">...</ul></div><div class=\"card\">...</div></div>. Use it for before and after, or this versus that.",
  "  - Inline bars: <div class=\"hbars\"><div class=\"hbar\"><span>Label</span><i style=\"--w:70%\"></i><em>70</em></div>...</div>, the width being the value as a percent of the largest. Same rule as charts: only real numbers.",
  "  A slide is a heading (h1 or h2) plus at most one of these blocks. Do not stack a table and bullets on one slide.",
  "- Use real specifics from the repo (actual names, actual behavior) over generic phrasing. One idea per beat, generous whitespace. No gradients, icons or stock illustration style.",
];

const WORDS_PER_SCENE = 70; // a scene is roughly 30 seconds of narration

function sceneCountFor(budgetWords: number): number {
  return Math.min(14, Math.max(3, Math.round(budgetWords / WORDS_PER_SCENE)));
}

function formatContextLines(formatId: VideoFormatId): string[] {
  const format = VIDEO_FORMATS[formatId];
  return [
    `Visual mix: ${format.visualMix}`,
    format.screenShare === "required"
      ? "This format is built around the running product: include ui_demo beats where the presenter shows the product on screen."
      : format.screenShare === "optional"
        ? "ui_demo beats are optional here; use at most one in the whole video."
        : "Do not use ui_demo beats; the presenter will not be sharing a screen.",
  ];
}

// Stage 1: decide the shape of the whole video before writing any of it.
function buildPlanSystemPrompt(formatId: VideoFormatId, budgetWords: number, language: ScriptLanguage): string {
  const format = VIDEO_FORMATS[formatId];
  const count = sceneCountFor(budgetWords);
  return [
    `You plan a "${format.name}" video (${format.tagline}). Do not write the narration yet: produce the outline, one entry per scene.`,
    "",
    `Tone the scenes will be written in: ${format.tone}`,
    `Narration language: ${SCRIPT_LANGUAGES[language].name}. Write titles and purposes in English.`,
    "",
    "Suggested scene outline for this format. Follow its order and intent, stretching or splitting steps to fit the requested length and the actual repo:",
    ...format.scenes.map((scene, i) => `${i + 1}. ${scene.title}: ${scene.purpose}`),
    "",
    ...formatContextLines(formatId),
    "",
    `Length: the whole video should be about ${minutesLabel(budgetWords / WORDS_PER_MINUTE)} at ${WORDS_PER_MINUTE} spoken words per minute, so the target_words of all scenes must add up to about ${budgetWords}. Plan about ${count} scenes (each roughly ${Math.round(budgetWords / count)} words), giving the more important scenes more words.`,
    "",
    "Scene titles show on screen: plain and short (2 to 5 words), no colons, ampersands or clichés like 'Under the Hood'.",
    "",
    "For each scene's purpose, name the concrete repo material it will use (real function names, files, behavior) so the writer of that scene has what it needs. Charts are only allowed where the repo or the user's notes contain real numbers; never plan an invented metric.",
  ].join("\n");
}

// Stage 2: write one scene, knowing the whole outline so it doesn't repeat or contradict the others.
function buildWriteSystemPrompt(formatId: VideoFormatId, language: ScriptLanguage): string {
  const format = VIDEO_FORMATS[formatId];
  return [
    `You write ONE scene of a "${format.name}" video. The other scenes are written separately, so follow your scene's brief and length exactly.`,
    "",
    `Tone: ${format.tone}`,
    "",
    ...registerLines(language),
    "",
    ...spokenStyleRules(language),
    "",
    ...formatContextLines(formatId),
    "",
    ...VISUAL_RULES,
    "",
    "Keep every beat's narration short enough for one breath (about 12 to 25 words, one to three short sentences). Do not open with a greeting or 'in this video' unless you are told this is the first scene, and do not summarize the video unless this is the last scene.",
  ].join("\n");
}

function buildSceneSystemPrompt(formatId: VideoFormatId, mode: "scene" | "beat", language: ScriptLanguage): string {
  const format = VIDEO_FORMATS[formatId];
  return [
    `You build the visuals for part of a "${format.name}" video. The user has written or edited the narration; KEEP THEIR WORDING EXACTLY (only convert Devanagari to Latin letters if any appears). Do not add, drop or rephrase sentences.`,
    "",
    mode === "beat"
      ? "Return exactly ONE beat whose text is the narration given, with the visual_type that best supports it."
      : "Split the narration into beats at sentence boundaries (usually 1 to 3 sentences per beat) and choose the best visual for each. Give the scene a short fitting title.",
    "",
    `Visual mix for this format: ${format.visualMix}`,
    format.screenShare === "none" ? "Do not use ui_demo beats." : "ui_demo beats are allowed when the narration is about showing the product.",
    "",
    registerLines(language)[0],
    "",
    ...VISUAL_RULES,
  ].join("\n");
}

function buildUserMessage(ingest: IngestResult, userContext: string, sourceScript?: string, note?: string): string {
  const parts: string[] = [];
  parts.push(`Repo: ${ingest.repo_url}`);
  parts.push(`What to emphasize (from the user): ${userContext || "(none given — use your judgement)"}`);
  if (sourceScript) {
    parts.push(`\n--- The user's script (keep this wording) ---\n${sourceScript}`);
  }
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
  if (note) parts.push(`\n${note}`);
  return parts.join("\n");
}

// ------------------------------------------------------------ assembly

interface IdGenerator {
  scene(): string;
  beat(): string;
}

function idGenerator(prefix = ""): IdGenerator {
  let scenes = 0;
  let beats = 0;
  return {
    scene: () => `${prefix}scene-${++scenes}`,
    beat: () => `${prefix}beat-${++beats}`,
  };
}

function toBeat(raw: RawBeat, id: string, clean = false): Beat {
  return { id, text: clean ? cleanNarration(raw.text) : raw.text, visual_type: raw.visual_type, visual_spec: buildVisualSpec(raw) };
}

// Share of the user's words that survive in the generated beats (order-blind,
// so re-splitting into beats doesn't count against it). Models sometimes
// "improve" a script they were told to keep; this catches that.
export function wordPreservation(original: string, generatedTexts: string[]): number {
  const bag = new Map<string, number>();
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  for (const w of generatedTexts.join(" ").split(/\s+/).map(norm).filter(Boolean)) bag.set(w, (bag.get(w) ?? 0) + 1);
  const originalWords = original.split(/\s+/).map(norm).filter(Boolean);
  if (originalWords.length === 0) return 1;
  let kept = 0;
  for (const w of originalWords) {
    const left = bag.get(w) ?? 0;
    if (left > 0) {
      kept += 1;
      bag.set(w, left - 1);
    }
  }
  return kept / originalWords.length;
}

function sentencesOf(text: string): string[] {
  const parts = text.match(/[^.!?।]+[.!?।]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  return parts.length ? parts : [text.trim()];
}

function splitEvenly<T>(items: T[], groups: number): T[][] {
  const size = Math.max(1, Math.ceil(items.length / groups));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Last resort when the model won't keep the user's wording: build the scenes
// straight from their text (paragraphs become scenes, sentences group into
// beats) with plain title slides. Less pretty, but it is exactly their script.
export function scenesFromText(text: string): Scene[] {
  const ids = idGenerator();
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const groups = paragraphs.length >= 2 ? paragraphs : splitEvenly(sentencesOf(text), 3).map((g) => g.join(" "));
  return groups.map((group) => {
    const sentences = sentencesOf(group);
    const beats: Beat[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const beatText = sentences.slice(i, i + 2).join(" ");
      beats.push({ id: ids.beat(), text: beatText, visual_type: "slide", visual_spec: fallbackSlide(beatText) });
    }
    const title = sentences[0].split(/\s+/).slice(0, 5).join(" ");
    return { id: ids.scene(), title, beats };
  });
}

// -------------------------------------------------------------- public

// Runs `fn` over `items` with at most `limit` in flight, keeping result order.
// Splits a user-written script into scenes without asking a model: paragraphs
// become scenes (or, for one block of text, groups of sentences of about a
// scene's length). Their words are untouched; each scene's title and visuals
// are chosen when the scene is written.
export function planFromSourceScript(text: string): PlannedScene[] {
  const clean = text.trim();
  const paragraphs = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  let chunks: string[];
  if (paragraphs.length >= 2) {
    chunks = paragraphs;
  } else {
    const sentences = sentencesOf(clean);
    const groups = Math.min(14, Math.max(1, Math.round(countWords(clean) / WORDS_PER_SCENE)));
    chunks = splitEvenly(sentences, groups).map((g) => g.join(" "));
  }
  // Very long inputs: merge the smallest neighbours so we stay within the cap.
  while (chunks.length > 14) {
    let best = 0;
    let bestSize = Infinity;
    for (let i = 0; i < chunks.length - 1; i++) {
      const size = countWords(chunks[i]) + countWords(chunks[i + 1]);
      if (size < bestSize) {
        best = i;
        bestSize = size;
      }
    }
    chunks.splice(best, 2, `${chunks[best]}\n\n${chunks[best + 1]}`);
  }
  return chunks.map((chunk) => ({
    title: "",
    purpose: "Build the visuals for the user's own narration.",
    target_words: Math.max(1, countWords(chunk)),
    source_text: chunk,
  }));
}

export async function planScript(
  ingest: IngestResult,
  userContext: string,
  format: VideoFormatId,
  options: GenerationOptions,
  language: ScriptLanguage = DEFAULT_SCRIPT_LANGUAGE,
): Promise<PlannedScene[]> {
  if (options.sourceScript) return planFromSourceScript(options.sourceScript);

  const minutes = options.targetMinutes ?? VIDEO_FORMATS[format].defaultMinutes;
  const budget = wordBudget(minutes);
  const toolInput = await getLlmClient().converseWithForcedTool({
    system: buildPlanSystemPrompt(format, budget, language),
    userMessage: buildUserMessage(ingest, userContext),
    tool: EMIT_OUTLINE_TOOL,
  });
  const parsed = ScriptPlanResponseSchema.parse(toolInput);

  // The model's per-scene numbers rarely add up to the budget; rescale so the
  // video lands on the length that was asked for.
  const total = parsed.scenes.reduce((sum, s) => sum + s.target_words, 0) || budget;
  const scale = budget / total;
  return parsed.scenes.map((scene) => ({ ...scene, target_words: Math.max(15, Math.round(scene.target_words * scale)) }));
}

function outlineLines(outline: PlannedScene[], index: number): string[] {
  return outline.map((s, i) => `${i === index ? "-> " : "   "}${i + 1}. ${s.title || "(scene)"}: ${s.purpose}`);
}

// Stage 2: write one planned scene. Retries once if the length is well off.
export async function writePlannedScene(params: {
  ingest: IngestResult;
  format: VideoFormatId;
  language?: ScriptLanguage;
  userContext: string;
  outline: PlannedScene[];
  index: number;
}): Promise<SceneGenResponse> {
  const { ingest, format, userContext, outline, index } = params;
  const language = params.language ?? DEFAULT_SCRIPT_LANGUAGE;
  const planned = outline[index];
  if (!planned) throw new Error(`No scene at index ${index}`);

  // The user's own narration: keep it verbatim, just build visuals around it.
  if (planned.source_text) {
    return generateScene({ ingest, format, language, userContext, sceneTitle: planned.title, narration: planned.source_text, mode: "scene" });
  }

  const llm = getLlmClient();
  const ids = idGenerator(`${Date.now().toString(36)}-`);
  const isFirst = index === 0;
  const isLast = index === outline.length - 1;
  const brief = [
    `This is scene ${index + 1} of ${outline.length}${isFirst ? " (the opening scene)" : isLast ? " (the closing scene)" : ""}.`,
    `Title: ${planned.title}`,
    `Brief: ${planned.purpose}`,
    `Length: about ${planned.target_words} words of narration in total across its beats (between ${Math.round(planned.target_words * 0.85)} and ${Math.round(planned.target_words * 1.15)}).`,
    "",
    "The whole video's outline (-> marks your scene):",
    ...outlineLines(outline, index),
  ];

  async function attempt(note?: string) {
    const toolInput = await llm.converseWithForcedTool({
      system: buildWriteSystemPrompt(format, language),
      userMessage: buildUserMessage(ingest, userContext, undefined, `${brief.join("\n")}${note ? `\n\n${note}` : ""}`),
      tool: EMIT_SCENE_TOOL,
    });
    return RawSceneOutputSchema.parse(toolInput);
  }
  const words = (raw: z.infer<typeof RawSceneOutputSchema>) => raw.beats.reduce((n, b) => n + countWords(b.text), 0);

  const target = planned.target_words;
  const styleHits = (raw: z.infer<typeof RawSceneOutputSchema>) => machineWritingHits([raw.title, ...raw.beats.map((b) => b.text)].join(" "));
  const lengthOff = (raw: z.infer<typeof RawSceneOutputSchema>) => words(raw) < target * 0.65 || words(raw) > target * 1.4;
  // Lower is better: every machine-sounding phrase counts, plus how far the length is off.
  const penalty = (raw: z.infer<typeof RawSceneOutputSchema>) => styleHits(raw).length + (Math.abs(words(raw) - target) / target) * 5;

  let raw = await attempt();
  const notes: string[] = [];
  if (lengthOff(raw)) {
    const direction = words(raw) > target ? "too long" : "too short";
    notes.push(
      `Your previous draft of this scene was ${direction}: ${words(raw)} words, target about ${target}. Rewrite it to land between ${Math.round(target * 0.85)} and ${Math.round(target * 1.15)} words.`,
    );
  }
  const hits = styleHits(raw);
  if (hits.length > 0) {
    notes.push(`Your previous draft used machine-sounding wording (${hits.join(", ")}). Say the plain thing instead, in short spoken sentences.`);
  }
  // One retry covers both problems; keep whichever draft is better.
  if (notes.length > 0) {
    const retry = await attempt(notes.join("\n"));
    if (penalty(retry) < penalty(raw)) raw = retry;
  }
  return { title: raw.title || planned.title, beats: raw.beats.map((b) => toBeat(b, ids.beat(), true)) };
}

// Rebuilds one scene (or a single beat) from narration the user edited. The
// wording is theirs; the visuals are regenerated to match it. Ids are made
// unique per call so beats added to an existing script never collide with it.
export async function generateScene(params: {
  ingest: IngestResult;
  format: VideoFormatId;
  language?: ScriptLanguage;
  userContext: string;
  sceneTitle: string;
  narration: string;
  mode: "scene" | "beat";
}): Promise<SceneGenResponse> {
  const { ingest, format, userContext, sceneTitle, narration, mode } = params;
  const language = params.language ?? DEFAULT_SCRIPT_LANGUAGE;
  const llm = getLlmClient();
  const ids = idGenerator(`${Date.now().toString(36)}-`);

  async function attempt(note?: string) {
    const toolInput = await llm.converseWithForcedTool({
      system: buildSceneSystemPrompt(format, mode, language),
      userMessage: buildUserMessage(
        ingest,
        userContext,
        narration,
        `${sceneTitle ? `Scene title so far: ${sceneTitle}\n` : ""}${note ?? ""}`,
      ),
      tool: EMIT_SCENE_TOOL,
    });
    return RawSceneOutputSchema.parse(toolInput);
  }

  const isFaithful = (raw: z.infer<typeof RawSceneOutputSchema>) =>
    wordPreservation(narration, raw.beats.map((b) => b.text)) >= 0.85 && (mode === "scene" || raw.beats.length === 1);

  let raw = await attempt();
  if (!isFaithful(raw)) raw = await attempt("Keep the user's wording exactly and return the requested number of beats.");

  if (!isFaithful(raw)) {
    // Still not faithful: keep their text verbatim rather than a rewrite.
    const beats: Beat[] =
      mode === "beat"
        ? [{ id: ids.beat(), text: narration.trim(), visual_type: "slide", visual_spec: fallbackSlide(narration) }]
        : scenesFromText(narration).flatMap((s) => s.beats).map((b) => ({ ...b, id: ids.beat() }));
    return { title: sceneTitle || "Scene", beats };
  }
  return { title: raw.title || sceneTitle, beats: raw.beats.map((b) => toBeat(b, ids.beat())) };
}
