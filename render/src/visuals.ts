import { codeToHtml } from "shiki";
import type { Beat, IngestResult, VisualSpec } from "@vaani/shared";

// Video frame size — Playwright screenshots at exactly this viewport, so
// every beat's visual is already the right dimensions for ffmpeg.
const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;
const CONTEXT_LINES = 5;

function findFileContent(ingest: IngestResult, filePath: string): string | null {
  const file = [...ingest.sample_files, ...ingest.package_files].find((f) => f.path === filePath);
  return file?.content ?? null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Shared design system for every generated visual — one consistent palette
// and type scale across the whole video, not each beat improvising its own.
// Values match one-dark-pro (the theme code_highlight already renders with,
// see codeHighlightHtml below), so slide/graph beats don't visually clash
// against the code beats sitting right next to them in the same video.
// Inspired by /brag's "Visual Identity" step (extract exact bg/text/accent
// colors + fonts and apply them consistently, not per-scene improvisation)
// and its landing page's own look (big bold type, high contrast, minimal) —
// researched this session, see PROGRESS.md. System font stack on purpose,
// not a web font: render runs headless on Fargate with no network font
// loading in the critical path, so this can't silently degrade or slow
// down a render.
const DESIGN_SYSTEM_STYLE = `
  :root {
    --bg: #282c34;
    --bg-elevated: #2c313a;
    --fg: #e6e6e6;
    --fg-muted: #9199a8;
    --accent: #61afef;
    --accent-warm: #e5c07b;
    --font: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }
  body { background: var(--bg); color: var(--fg); font-family: var(--font); }
  .slide { display: flex; flex-direction: column; justify-content: center; gap: 20px; height: 100%; padding: 64px 72px; }
  .slide h1, .slide h2 { margin: 0; font-weight: 700; letter-spacing: -0.01em; line-height: 1.15; }
  .slide h1 { font-size: 56px; }
  .slide h2 { font-size: 36px; color: var(--fg-muted); font-weight: 500; }
  .slide p { margin: 0; font-size: 28px; line-height: 1.5; color: var(--fg); }
  .slide .accent { color: var(--accent); }
  .slide .accent-warm { color: var(--accent-warm); }
  .slide code, .slide .mono { font-family: var(--font-mono); background: var(--bg-elevated); padding: 2px 8px; border-radius: 6px; }
  .slide .card { background: var(--bg-elevated); border-radius: 12px; padding: 32px; }
`;

function basePage(bodyHtml: string, extraStyle = ""): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: ${FRAME_WIDTH}px; height: ${FRAME_HEIGHT}px; overflow: hidden; }
    ${DESIGN_SYSTEM_STYLE}
    ${extraStyle}
  </style></head><body>${bodyHtml}</body></html>`;
}

function placeholder(message: string): string {
  return basePage(
    `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--fg-muted);font-family:var(--font);font-size:24px;">${escapeHtml(message)}</div>`,
  );
}

async function codeHighlightHtml(
  spec: Extract<VisualSpec, { visual_type: "code_highlight" }>,
  ingest: IngestResult,
): Promise<string> {
  const content = findFileContent(ingest, spec.file_path);
  if (!content) {
    return placeholder(`${spec.file_path || "(no file)"} not available`);
  }

  const lines = content.split("\n");
  const windowStart = Math.max(1, spec.start_line - CONTEXT_LINES);
  const windowEnd = Math.min(lines.length, spec.end_line + CONTEXT_LINES);
  const snippet = lines.slice(windowStart - 1, windowEnd).join("\n");
  const decorationStartLine = spec.start_line - windowStart;
  const decorationEndLine = spec.end_line - windowStart + 1;

  const html = await codeToHtml(snippet, {
    lang: spec.language ?? "text",
    theme: "one-dark-pro",
    decorations: [
      {
        start: { line: decorationStartLine, character: 0 },
        end: { line: decorationEndLine, character: 0 },
        properties: { class: "highlighted-line" },
      },
    ],
  });

  return basePage(`<div style="font-size:16px; padding:24px; height:100%;">${html}</div>`, `
    pre { margin: 0; height: 100%; overflow: hidden; }
    .line { display: block; }
    .highlighted-line { background: rgba(250, 204, 21, 0.22); }
  `);
}

export async function beatVisualHtml(beat: Beat, ingest: IngestResult): Promise<string> {
  switch (beat.visual_spec.visual_type) {
    case "code_highlight":
      return codeHighlightHtml(beat.visual_spec, ingest);
    case "slide":
    case "graph":
      // Wrapped in the shared .slide container (padding, centering, type
      // scale from DESIGN_SYSTEM_STYLE) rather than handing the LLM a bare
      // body — script-gen's prompt asks for inner content only (h1/p/.card
      // etc.), not full-page layout, so every slide/graph beat gets the
      // same visual identity regardless of what the model generates.
      return basePage(`<div class="slide">${beat.visual_spec.html}</div>`);
    case "ui_demo":
      return placeholder(`Live demo: ${beat.visual_spec.note || "(no description)"}`);
  }
}

export { FRAME_WIDTH, FRAME_HEIGHT };
