import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { MonitorPlay } from "lucide-react";
import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  chartHtml,
  demoFrameHtml,
  diagramHtml,
  slideHtml,
  type IngestResult,
  type VisualSpec,
} from "@vaani/shared";

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

// Renders the exact page the video renderer screenshots (same shared HTML/CSS),
// at its real 1280x720 size inside a sandboxed iframe, then scales it down to
// the available width. So what someone reviews is what gets rendered, including
// the entrance animation. LLM-authored HTML is untrusted content: the iframe
// has no scripts and no same-origin access.
function FramePreview({ html }: { html: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / FRAME_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="relative w-full overflow-hidden rounded-md border bg-background" style={{ aspectRatio: `${FRAME_WIDTH} / ${FRAME_HEIGHT}` }}>
      <iframe
        title="Visual preview"
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        className="absolute top-0 left-0 origin-top-left border-0"
        style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT, transform: `scale(${scale})` }}
      />
    </div>
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
      return <FramePreview html={slideHtml(spec.html, undefined)} />;
    case "diagram":
      return <FramePreview html={diagramHtml(spec, undefined)} />;
    case "chart":
      return <FramePreview html={chartHtml(spec, undefined)} />;
    case "ui_demo":
      return (
        <div className="flex flex-col gap-3">
          <FramePreview html={demoFrameHtml(spec.note || "Live demo", undefined, "Your screen recording plays here")} />
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <MonitorPlay className="mt-0.5 size-3.5 shrink-0" />
            You'll share your screen for this beat while you talk. Your recording goes here.
          </p>
        </div>
      );
  }
}
