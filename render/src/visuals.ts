import { codeToHtml } from "shiki";
import {
  CHROME_HEIGHT,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  chartHtml,
  diagramHtml,
  escapeHtml,
  pageHtml,
  placeholderHtml,
  slideHtml,
  type Beat,
  type BeatChrome,
  type IngestResult,
  type VisualSpec,
} from "@vaani/shared";

// How a beat looks (design system, diagram, chart, slide, chrome bar) lives in
// @vaani/shared so the browser's review page renders exactly the same markup.
// This file adds only what needs Node: Shiki-highlighted code.
const CONTEXT_LINES = 5;

function findFileContent(ingest: IngestResult, filePath: string): string | null {
  const file = [...ingest.sample_files, ...ingest.package_files].find((f) => f.path === filePath);
  return file?.content ?? null;
}

// Removes the indentation shared by every non-blank line, so a snippet cut out
// of deeply nested code sits at the left edge of the code window instead of
// being pushed several tab stops to the right (found on a real tab-indented repo).
function dedent(lines: string[]): string[] {
  const indents = lines.filter((l) => l.trim() !== "").map((l) => (/^[\t ]*/.exec(l)?.[0].length ?? 0));
  const common = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(Math.min(common, /^[\t ]*/.exec(l)?.[0].length ?? 0)));
}

async function codeHighlightHtml(
  spec: Extract<VisualSpec, { visual_type: "code_highlight" }>,
  ingest: IngestResult,
  chrome: BeatChrome | undefined,
): Promise<string> {
  const content = findFileContent(ingest, spec.file_path);
  if (!content) {
    return placeholderHtml(`${spec.file_path || "(no file)"} not available`, chrome);
  }

  const lines = content.split("\n");
  const windowStart = Math.max(1, spec.start_line - CONTEXT_LINES);
  const windowEnd = Math.min(lines.length, spec.end_line + CONTEXT_LINES);
  const snippet = dedent(lines.slice(windowStart - 1, windowEnd)).join("\n");

  // Tag each line (1-based within the snippet) as highlighted or context, so
  // CSS can dim the context and sweep the highlight in. A per-line transformer
  // is used instead of a range decoration because it puts the class on the
  // line element itself, which is what the dimming/animation selectors need.
  const firstHighlighted = spec.start_line - windowStart + 1;
  const lastHighlighted = spec.end_line - windowStart + 1;
  const html = await codeToHtml(snippet, {
    lang: spec.language ?? "text",
    theme: "one-dark-pro",
    transformers: [
      {
        line(node, lineNumber) {
          const highlighted = lineNumber >= firstHighlighted && lineNumber <= lastHighlighted;
          this.addClassToHast(node, highlighted ? "hl" : "ctx");
          node.properties.style = `--n:${lineNumber - 1}`;
        },
      },
    ],
  });

  const lineCount = windowEnd - windowStart + 1;
  // Long snippets shrink so the whole window stays on screen.
  const fontSize = lineCount > 22 ? 14 : lineCount > 16 ? 16 : 19;
  const range = spec.start_line === spec.end_line ? `L${spec.start_line}` : `L${spec.start_line}-${spec.end_line}`;

  return pageHtml(
    `<div class="code-wrap">
      <div class="code-window">
        <div class="code-title"><span class="code-file">${escapeHtml(spec.file_path)}</span><span class="code-range">${range}</span></div>
        <div class="code-body" style="font-size:${fontSize}px">${html}</div>
      </div>
    </div>`,
    chrome,
    `
    .code-wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 34px 72px; }
    .code-window {
      width: 100%; max-height: 100%; overflow: hidden; display: flex; flex-direction: column;
      background: #21252b; border: 1px solid var(--border); border-radius: 16px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
      animation: vaani-pop 0.6s var(--ease) both;
    }
    .code-title { display: flex; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--border); font-family: var(--font-mono); font-size: 14px; color: var(--fg-muted); }
    .code-range { color: var(--accent-warm); }
    .code-body { padding: 16px 0; overflow: hidden; }
    .code-body pre { margin: 0; background: transparent !important; tab-size: 2; -moz-tab-size: 2; }
    .code-body code { display: flex; flex-direction: column; }
    .code-body .line { display: block; padding: 1px 24px; line-height: 1.6; animation: vaani-line-in 0.5s var(--ease) both; animation-delay: calc(var(--n) * 28ms); }
    .code-body .line.ctx { --final: 0.42; }
    .code-body .line.hl {
      --final: 1;
      background: linear-gradient(90deg, rgba(229, 192, 123, 0.2), rgba(229, 192, 123, 0.12)) no-repeat left / 100% 100%;
      animation: vaani-line-in 0.5s var(--ease) both, vaani-sweep 0.7s var(--ease) 0.4s both;
      animation-delay: calc(var(--n) * 28ms), 0.4s;
    }
  `,
  );
}

export async function beatVisualHtml(beat: Beat, ingest: IngestResult, chrome?: BeatChrome): Promise<string> {
  const spec = beat.visual_spec;
  switch (spec.visual_type) {
    case "code_highlight":
      return codeHighlightHtml(spec, ingest, chrome);
    case "slide":
    case "graph":
      return slideHtml(spec.html, chrome);
    case "diagram":
      return diagramHtml(spec, chrome);
    case "chart":
      return chartHtml(spec, chrome);
    case "ui_demo":
      // Without recorded footage (the AI-voice fallback path has none) show
      // what the viewer would have seen. With footage, realRender.ts replaces
      // this beat with the actual screen recording.
      return placeholderHtml(`Live demo: ${spec.note || "(no description)"}`, chrome);
  }
}

// Builds the bottom-bar info for one beat from where it sits in the script.
export function chromeFor(scenes: { title: string; beats: unknown[] }[], sceneIndex: number, beatIndex: number): BeatChrome {
  return {
    sceneTitle: scenes[sceneIndex].title,
    sceneIndex,
    sceneCount: scenes.length,
    beatIndex,
    beatCount: scenes[sceneIndex].beats.length,
  };
}

export { FRAME_WIDTH, FRAME_HEIGHT, CHROME_HEIGHT, escapeHtml };
export type { VisualSpec };
