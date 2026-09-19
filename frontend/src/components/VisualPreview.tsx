import { useEffect, useId, useRef, type CSSProperties } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { IngestResult, VisualSpec } from "@vaani/shared";

interface VisualPreviewProps {
  spec: VisualSpec;
  ingestResult: IngestResult | null;
}

function findFileContent(ingestResult: IngestResult | null, filePath: string): string | null {
  if (!ingestResult) return null;
  const file = [...ingestResult.sample_files, ...ingestResult.package_files].find(
    (f) => f.path === filePath,
  );
  return file?.content ?? null;
}

// Same design tokens/wrapper as render/src/visuals.ts's DESIGN_SYSTEM_STYLE
// — kept in sync manually rather than shared as code, since frontend and
// render are separate workspaces (see PROGRESS.md) and this is small enough
// that duplicating it here is simpler than adding a shared-code dependency
// for a few lines of CSS. Without this, review would show LLM content on a
// plain white background while the actual rendered video is dark — this
// preview should show what the beat will really look like, not something
// close to it.
const SLIDE_PREVIEW_STYLE = `
  :root {
    --bg: #282c34; --bg-elevated: #2c313a; --fg: #e6e6e6; --fg-muted: #9199a8;
    --accent: #61afef; --accent-warm: #e5c07b;
    --font: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body { background: var(--bg); color: var(--fg); font-family: var(--font); }
  .slide { display: flex; flex-direction: column; justify-content: center; gap: 16px; height: 100%; padding: 24px 28px; }
  .slide h1, .slide h2 { margin: 0; font-weight: 700; letter-spacing: -0.01em; line-height: 1.15; }
  .slide h1 { font-size: 26px; }
  .slide h2 { font-size: 17px; color: var(--fg-muted); font-weight: 500; }
  .slide p { margin: 0; font-size: 14px; line-height: 1.5; }
  .slide .accent { color: var(--accent); }
  .slide .accent-warm { color: var(--accent-warm); }
  .slide code, .slide .mono { font-family: var(--font-mono); background: var(--bg-elevated); padding: 1px 6px; border-radius: 4px; }
  .slide .card { background: var(--bg-elevated); border-radius: 8px; padding: 16px; }
`;

// LLM-authored HTML is untrusted content — render it in a fully sandboxed
// iframe (no scripts, no same-origin) rather than dangerouslySetInnerHTML
// into the main document.
function HtmlPreview({ html }: { html: string }) {
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>${SLIDE_PREVIEW_STYLE}</style></head><body><div class="slide">${html}</div></body></html>`;
  return (
    <iframe title="Visual preview" srcDoc={srcDoc} sandbox="" className="h-64 w-full rounded-md border" />
  );
}

function CodeHighlightPreview({
  spec,
  ingestResult,
}: {
  spec: Extract<VisualSpec, { visual_type: "code_highlight" }>;
  ingestResult: IngestResult | null;
}) {
  const content = findFileContent(ingestResult, spec.file_path);
  const instanceId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!content) return;
    // The highlighted range can be anywhere in a long file — scroll it into
    // view instead of leaving the preview showing line 1 by default.
    const target = containerRef.current?.querySelector(`#${CSS.escape(instanceId)}-target`);
    target?.scrollIntoView({ block: "center" });
  }, [content, instanceId, spec.start_line, spec.end_line]);

  if (!content) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
        {spec.file_path || "(no file)"} not available in this session's ingest data
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-h-64 overflow-auto rounded-md border text-xs">
      <SyntaxHighlighter
        language={spec.language}
        style={oneDark}
        showLineNumbers
        wrapLines
        lineProps={(lineNumber: number): { style: CSSProperties; id?: string } => {
          const inRange = lineNumber >= spec.start_line && lineNumber <= spec.end_line;
          return {
            style: inRange ? { backgroundColor: "rgba(250, 204, 21, 0.18)", display: "block" } : {},
            id: lineNumber === spec.start_line ? `${instanceId}-target` : undefined,
          };
        }}
        customStyle={{ margin: 0 }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
}

export function VisualPreview({ spec, ingestResult }: VisualPreviewProps) {
  switch (spec.visual_type) {
    case "code_highlight":
      return <CodeHighlightPreview spec={spec} ingestResult={ingestResult} />;
    case "slide":
    case "graph":
      return <HtmlPreview html={spec.html} />;
    case "ui_demo":
      return (
        <div className="flex h-24 items-center justify-center rounded-md border border-dashed bg-muted text-sm text-muted-foreground">
          Live screen-share demo: {spec.note || "(no description)"}
        </div>
      );
  }
}
