// Everything that decides how a beat LOOKS, as plain strings, so the video
// renderer (Playwright screenshots on Fargate) and the review page in the
// browser use the exact same markup and CSS. The frontend shows this HTML in
// an iframe scaled down from the real 1280x720 canvas, so what a person
// reviews is what gets rendered. Only code-highlight beats differ (the
// renderer uses Shiki, the browser a JS highlighter).
import type { ChartSpec, DiagramSpec } from "./index.js";

export const FRAME_WIDTH = 1280;
export const FRAME_HEIGHT = 720;
export const CHROME_HEIGHT = 48;
const STAGE_HEIGHT = FRAME_HEIGHT - CHROME_HEIGHT;

// Where a beat sits in the video, for the persistent bottom bar.
export interface BeatChrome {
  sceneTitle: string;
  sceneIndex: number;
  sceneCount: number;
  beatIndex: number;
  beatCount: number;
  // The presenter's face is added over the finished frame (bottom-right). Set
  // when it will be, so the visual leaves room for it.
  hasFace?: boolean;
}

// The presenter's round camera bubble, in frame pixels. The renderer overlays
// the video here; the page itself only draws the ring behind it.
export const FACE_BUBBLE = { x: 1077, y: 472, size: 176 } as const;
// With a face, the visual is drawn a little smaller and centered in the
// space left of the bubble column, so nothing runs under the bubble. Scaling
// the whole stage (instead of narrowing it) keeps diagrams and code undistorted.
const FACE_STAGE_SCALE = 0.82;
const FACE_STAGE_TOP = Math.round((FRAME_HEIGHT - CHROME_HEIGHT) * (1 - FACE_STAGE_SCALE) / 2);

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// One palette and type scale for every visual. Colors match one-dark-pro (what
// code beats render with). System fonts on purpose: the renderer runs
// headless with no network font loading in its critical path.
//
// Motion: every beat animates in once. The renderer captures the first
// INTRO_SECONDS of these CSS animations as real video frames (it pauses every
// animation and steps its clock), then holds the settled state, so every
// animation here must finish inside that window — keep delays + durations
// under ~1.2s. All use an exponential ease-out and fill "both" so the first
// frame is the hidden start state.
export const DESIGN_SYSTEM_CSS = `
  :root {
    --bg: #23272e;
    --bg-deep: #1b1e24;
    --bg-elevated: #2c313a;
    --border: rgba(255, 255, 255, 0.08);
    --fg: #eceff4;
    --fg-muted: #9199a8;
    --accent: #61afef;
    --accent-warm: #e5c07b;
    --success: #98c379;
    --ease: cubic-bezier(0.16, 1, 0.3, 1);
    --font: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }
  html { background: var(--bg-deep); }
  body {
    position: relative;
    color: var(--fg);
    font-family: var(--font);
    background: radial-gradient(90% 80% at 50% 0%, #2d323c 0%, var(--bg) 52%, var(--bg-deep) 100%);
  }
  /* Faint blueprint grid, fading out toward the edges. */
  body::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
    background-size: 64px 64px;
    -webkit-mask-image: radial-gradient(75% 70% at 50% 40%, black, transparent);
    mask-image: radial-gradient(75% 70% at 50% 40%, black, transparent);
    pointer-events: none;
  }
  .stage { position: absolute; inset: 0 0 ${CHROME_HEIGHT}px 0; }

  @keyframes vaani-rise {
    from { opacity: 0; transform: translateY(18px); filter: blur(8px); }
    to   { opacity: 1; transform: none; filter: blur(0); }
  }
  @keyframes vaani-pop {
    from { opacity: 0; transform: scale(0.97) translateY(10px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes vaani-line-in {
    from { opacity: 0; transform: translateX(-10px); }
    to   { opacity: var(--final, 1); transform: none; }
  }
  @keyframes vaani-sweep {
    from { background-size: 0% 100%; }
    to   { background-size: 100% 100%; }
  }
  @keyframes vaani-draw {
    from { stroke-dashoffset: 1; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes vaani-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes vaani-bar {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }

  .slide { display: flex; flex-direction: column; justify-content: center; gap: 22px; height: 100%; padding: 56px 88px; }
  .slide > * { animation: vaani-rise 0.7s var(--ease) both; animation-delay: calc(var(--i, 0) * 110ms); }
  .slide > :nth-child(1) { --i: 0; } .slide > :nth-child(2) { --i: 1; } .slide > :nth-child(3) { --i: 2; }
  .slide > :nth-child(4) { --i: 3; } .slide > :nth-child(5) { --i: 4; } .slide > :nth-child(n+6) { --i: 5; }
  .slide h1, .slide h2 { margin: 0; font-weight: 700; letter-spacing: -0.02em; line-height: 1.12; text-wrap: balance; }
  .slide h1 { font-size: 60px; }
  .slide h2 { font-size: 34px; color: var(--fg-muted); font-weight: 500; }
  .slide p { margin: 0; font-size: 28px; line-height: 1.5; color: var(--fg); max-width: 980px; }
  .slide .accent { color: var(--accent); }
  .slide .accent-warm { color: var(--accent-warm); }
  .slide code, .slide .mono { font-family: var(--font-mono); background: var(--bg-elevated); border: 1px solid var(--border); padding: 2px 9px; border-radius: 7px; font-size: 0.92em; }
  .slide .card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 14px; padding: 30px 34px; animation-name: vaani-pop; }
  /* One big statement, for a hook / problem / call to action. */
  .slide .statement { font-size: 76px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; max-width: 1050px; }

  .chrome {
    position: absolute; left: 0; right: 0; bottom: 0; height: ${CHROME_HEIGHT}px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 40px; border-top: 1px solid var(--border);
    background: rgba(27, 30, 36, 0.72);
    font-size: 15px; color: var(--fg-muted);
  }
  .chrome-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .chrome-mark { display: inline-flex; align-items: center; justify-content: center; gap: 2px; width: 24px; height: 24px; border-radius: 7px; background: var(--accent); }
  .chrome-mark i { display: block; width: 2px; border-radius: 2px; background: #10131a; }
  .chrome-scene { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 640px; }
  .chrome-scene b { color: var(--fg); font-weight: 600; }
  .chrome-steps { display: flex; gap: 6px; align-items: center; }
  .chrome-steps span { display: block; width: 26px; height: 4px; border-radius: 4px; background: rgba(255, 255, 255, 0.12); }
  .chrome-steps span.done { background: rgba(97, 175, 239, 0.45); }
  .chrome-steps span.now { background: var(--accent); }

  /* Diagram */
  .dg { position: absolute; inset: 0; }
  .dg-title { position: absolute; left: 88px; top: 46px; margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.02em; animation: vaani-rise 0.7s var(--ease) both; }
  .dg svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .dg-edge { fill: none; stroke: rgba(145, 153, 168, 0.75); stroke-width: 2.5; stroke-dasharray: 1; stroke-dashoffset: 1; animation: vaani-draw 0.5s var(--ease) both; }
  .dg-arrow { fill: rgba(145, 153, 168, 0.95); animation: vaani-fade 0.3s ease-out both; }
  .dg-edge-label { font: 600 14px var(--font); fill: var(--fg-muted); animation: vaani-fade 0.4s ease-out both; }
  .dg-edge-label-bg { fill: var(--bg-deep); animation: vaani-fade 0.4s ease-out both; }
  .dg-node rect { fill: var(--bg-elevated); stroke: var(--border); stroke-width: 1.5; }
  .dg-node.hero rect { fill: rgba(97, 175, 239, 0.14); stroke: rgba(97, 175, 239, 0.7); }
  .dg-node { animation: vaani-pop 0.45s var(--ease) both; transform-box: fill-box; transform-origin: center; }
  .dg-label { font: 700 20px var(--font); fill: var(--fg); }
  .dg-detail { font: 500 14px var(--font); fill: var(--fg-muted); }

  /* Chart */
  .ch { position: absolute; inset: 0; padding: 46px 88px 40px; display: flex; flex-direction: column; gap: 22px; }
  .ch-head { animation: vaani-rise 0.7s var(--ease) both; }
  .ch-title { margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.02em; }
  .ch-unit { margin-top: 4px; font-size: 18px; color: var(--fg-muted); }
  .ch-rows { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 18px; }
  .ch-row { display: grid; grid-template-columns: 250px 1fr; align-items: center; gap: 22px; }
  .ch-label { font-size: 22px; font-weight: 600; text-align: right; color: var(--fg); }
  .ch-track { position: relative; height: 44px; }
  .ch-bar { position: absolute; inset: 0 auto 0 0; border-radius: 10px; background: var(--accent); transform-origin: left center; animation: vaani-bar 0.7s var(--ease) both; display: flex; align-items: center; justify-content: flex-end; }
  .ch-row.top .ch-bar { background: var(--accent-warm); }
  .ch-value { position: absolute; top: 50%; transform: translateY(-50%); margin-left: 14px; font: 700 22px var(--font-mono); animation: vaani-fade 0.5s ease-out both; }
  .ch-source { font-size: 15px; color: var(--fg-muted); animation: vaani-fade 0.6s ease-out 0.5s both; }

  /* Product demo footage sits inside this frame (video overlaid by the renderer). */
  .demo-title { position: absolute; left: 88px; top: 38px; margin: 0; font-size: 22px; font-weight: 600; color: var(--fg-muted); }
`;

export function chromeHtml(chrome: BeatChrome | undefined): string {
  if (!chrome) return "";
  const steps = Array.from({ length: chrome.beatCount }, (_, i) =>
    `<span class="${i < chrome.beatIndex ? "done" : i === chrome.beatIndex ? "now" : ""}"></span>`,
  ).join("");
  return `<div class="chrome">
    <div class="chrome-left">
      <span class="chrome-mark"><i style="height:7px"></i><i style="height:13px"></i><i style="height:9px"></i><i style="height:12px"></i></span>
      <span class="chrome-scene"><b>${chrome.sceneIndex + 1}/${chrome.sceneCount}</b>&nbsp;&nbsp;${escapeHtml(chrome.sceneTitle)}</span>
    </div>
    <div class="chrome-steps" aria-hidden="true">${steps}</div>
  </div>`;
}

// `scaleStage: false` is for pages that place their own content around the
// bubble (the demo frame) instead of being shrunk to make room.
export function pageHtml(
  stageHtml: string,
  chrome: BeatChrome | undefined,
  extraCss = "",
  options: { scaleStage?: boolean } = {},
): string {
  const face = chrome?.hasFace === true;
  const scaleStage = face && options.scaleStage !== false;
  const faceCss = face
    ? `
    .face-ring { position: absolute; left: ${FACE_BUBBLE.x}px; top: ${FACE_BUBBLE.y}px; width: ${FACE_BUBBLE.size}px; height: ${FACE_BUBBLE.size}px; border-radius: 50%; background: #0e1014; box-shadow: 0 0 0 3px rgba(255,255,255,0.16), 0 18px 50px rgba(0,0,0,0.55); }
    ${scaleStage ? `.stage { inset: auto; left: 0; top: ${FACE_STAGE_TOP}px; width: ${FRAME_WIDTH}px; height: ${FRAME_HEIGHT - CHROME_HEIGHT}px; transform: scale(${FACE_STAGE_SCALE}); transform-origin: 0 0; }` : ""}`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: ${FRAME_WIDTH}px; height: ${FRAME_HEIGHT}px; overflow: hidden; }
    ${DESIGN_SYSTEM_CSS}
    ${extraCss}
    ${faceCss}
  </style></head><body><div class="stage">${stageHtml}</div>${face ? '<div class="face-ring"></div>' : ""}${chromeHtml(chrome)}</body></html>`;
}

export function slideHtml(innerHtml: string, chrome: BeatChrome | undefined): string {
  return pageHtml(`<div class="slide">${innerHtml}</div>`, chrome);
}

export function placeholderHtml(message: string, chrome: BeatChrome | undefined): string {
  return pageHtml(
    `<div class="slide" style="align-items:center;justify-content:center;"><p style="color:var(--fg-muted);font-size:26px;">${escapeHtml(message)}</p></div>`,
    chrome,
  );
}

// ---------------------------------------------------------------- diagram

const NODE_H = 92;

interface PlacedNode {
  id: string;
  label: string;
  detail?: string;
  x: number;
  y: number;
  w: number;
  hero: boolean;
  order: number;
}

// Assigns each node a column: one past the deepest node that feeds it. Edges
// that would close a cycle are ignored for layering (they still get drawn),
// so any graph the model returns produces a sensible left-to-right flow.
function layerNodes(spec: DiagramSpec): Map<string, number> {
  const layer = new Map(spec.nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < spec.nodes.length; pass++) {
    let changed = false;
    for (const edge of spec.edges) {
      const from = layer.get(edge.from) ?? 0;
      const to = layer.get(edge.to) ?? 0;
      if (from + 1 > to && from + 1 < spec.nodes.length) {
        layer.set(edge.to, from + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return layer;
}

// Splits a label onto at most two lines at the space nearest the middle, and
// shortens anything that still doesn't fit, so text always stays inside its box.
function wrapLabel(label: string, maxChars: number): string[] {
  if (label.length <= maxChars) return [label];
  const words = label.split(" ");
  if (words.length === 1) return [`${label.slice(0, maxChars - 1)}…`];
  let best = 1;
  let bestGap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(" ").length;
    const right = words.slice(i).join(" ").length;
    const gap = Math.abs(left - right);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  }
  const lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  return lines.map((line) => (line.length > maxChars ? `${line.slice(0, maxChars - 1)}…` : line));
}

export function diagramHtml(spec: DiagramSpec, chrome: BeatChrome | undefined): string {
  const layers = layerNodes(spec);
  const layerCount = Math.max(...layers.values()) + 1;
  const nodeW = layerCount >= 5 ? 176 : layerCount === 4 ? 210 : layerCount === 3 ? 250 : 290;
  const left = 88;
  const right = FRAME_WIDTH - 88;
  const top = spec.title ? 130 : 70;
  const bottom = STAGE_HEIGHT - 50;

  const columns: string[][] = Array.from({ length: layerCount }, () => []);
  for (const node of spec.nodes) columns[layers.get(node.id) ?? 0].push(node.id);

  const placed = new Map<string, PlacedNode>();
  spec.nodes.forEach((node, order) => {
    const col = layers.get(node.id) ?? 0;
    const rowsInCol = columns[col];
    const row = rowsInCol.indexOf(node.id);
    const slot = (bottom - top) / rowsInCol.length;
    const x = layerCount === 1 ? (left + right - nodeW) / 2 : left + (col * (right - left - nodeW)) / (layerCount - 1);
    const y = top + slot * row + slot / 2 - NODE_H / 2;
    placed.set(node.id, { id: node.id, label: node.label, detail: node.detail, x, y, w: nodeW, hero: node.emphasis === true, order });
  });

  const edges = spec.edges
    .map((edge, index) => {
      const from = placed.get(edge.from);
      const to = placed.get(edge.to);
      if (!from || !to) return "";
      const sameColumn = layers.get(edge.from) === layers.get(edge.to);
      const x1 = from.x + from.w;
      const y1 = from.y + NODE_H / 2;
      const x2 = to.x;
      const y2 = to.y + NODE_H / 2;
      const delay = 350 + Math.min(index, 4) * 50;
      let d: string;
      let labelX: number;
      let labelY: number;
      if (sameColumn || x2 <= x1) {
        // Same column or a back edge: leave from the bottom/top and loop around.
        const sx = from.x + from.w / 2;
        const goingDown = to.y >= from.y;
        const sy = goingDown ? from.y + NODE_H : from.y;
        const ex = to.x + to.w / 2;
        const ey = goingDown ? to.y : to.y + NODE_H;
        const mid = (sy + ey) / 2;
        d = `M ${sx} ${sy} C ${sx} ${mid}, ${ex} ${mid}, ${ex} ${ey}`;
        labelX = (sx + ex) / 2;
        labelY = mid;
      } else {
        const cx = (x1 + x2) / 2;
        d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2 - 8} ${y2}`;
        labelX = cx;
        labelY = (y1 + y2) / 2;
      }
      const loop = sameColumn || x2 <= x1;
      const goingDown = to.y >= from.y;
      const tip = loop ? { x: to.x + to.w / 2, y: goingDown ? to.y : to.y + NODE_H } : { x: x2, y: y2 };
      const head = !loop
        ? `M ${tip.x} ${tip.y} l -12 -7 l 0 14 z`
        : goingDown
          ? `M ${tip.x} ${tip.y} l -7 -12 l 14 0 z`
          : `M ${tip.x} ${tip.y} l -7 12 l 14 0 z`;
      const arrow = `<path class="dg-arrow" d="${head}" style="animation-delay:${delay + 380}ms" />`;
      const labelText = edge.label ? escapeHtml(edge.label) : "";
      const label = edge.label
        ? `<rect class="dg-edge-label-bg" x="${labelX - edge.label.length * 4.4 - 8}" y="${labelY - 13}" width="${edge.label.length * 8.8 + 16}" height="24" rx="6" style="animation-delay:${delay + 300}ms" /><text class="dg-edge-label" x="${labelX}" y="${labelY + 4}" text-anchor="middle" style="animation-delay:${delay + 300}ms">${labelText}</text>`
        : "";
      return `<g><path class="dg-edge" pathLength="1" d="${d}" style="animation-delay:${delay}ms" />${arrow}${label}</g>`;
    })
    .join("");

  const nodes = [...placed.values()]
    .map((n) => {
      const delay = Math.min(n.order, 6) * 70;
      const lines = wrapLabel(n.label, Math.floor((n.w - 28) / 10.6));
      const detailLines = n.detail ? 1 : 0;
      const blockH = lines.length * 24 + detailLines * 20;
      let y = n.y + (NODE_H - blockH) / 2 + 18;
      const cx = n.x + n.w / 2;
      const label = lines
        .map((line, i) => `<text class="dg-label" x="${cx}" y="${y + i * 24}" text-anchor="middle">${escapeHtml(line)}</text>`)
        .join("");
      y += lines.length * 24;
      const detail = n.detail ? `<text class="dg-detail" x="${cx}" y="${y - 2}" text-anchor="middle">${escapeHtml(n.detail)}</text>` : "";
      return `<g class="dg-node${n.hero ? " hero" : ""}" style="animation-delay:${delay}ms">
        <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${NODE_H}" rx="14" />${label}${detail}
      </g>`;
    })
    .join("");

  const title = spec.title ? `<h2 class="dg-title">${escapeHtml(spec.title)}</h2>` : "";
  return pageHtml(
    `<div class="dg">${title}<svg viewBox="0 0 ${FRAME_WIDTH} ${STAGE_HEIGHT}" preserveAspectRatio="none">${edges}${nodes}</svg></div>`,
    chrome,
  );
}

// ------------------------------------------------------------------ chart

function formatValue(value: number, unit: string): string {
  const shown = Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return unit && unit.length <= 3 ? `${shown}${unit}` : shown;
}

export function chartHtml(spec: ChartSpec, chrome: BeatChrome | undefined): string {
  const max = Math.max(...spec.points.map((p) => p.value), 0) || 1;
  const topIndex = spec.points.findIndex((p) => p.value === max);
  const rows = spec.points
    .map((point, i) => {
      const pct = Math.max(2, (point.value / max) * 100);
      const delay = 250 + Math.min(i, 5) * 80;
      return `<div class="ch-row${i === topIndex ? " top" : ""}">
        <div class="ch-label">${escapeHtml(point.label)}</div>
        <div class="ch-track">
          <div class="ch-bar" style="width:${pct}%;animation-delay:${delay}ms"></div>
          <span class="ch-value" style="left:${pct}%;animation-delay:${delay + 450}ms">${escapeHtml(formatValue(point.value, spec.unit))}</span>
        </div>
      </div>`;
    })
    .join("");
  const unit = spec.unit && spec.unit.length > 3 ? `<div class="ch-unit">${escapeHtml(spec.unit)}</div>` : "";
  return pageHtml(
    `<div class="ch"><div class="ch-head"><h2 class="ch-title">${escapeHtml(spec.title)}</h2>${unit}</div><div class="ch-rows">${rows}</div><div class="ch-source">Source: ${escapeHtml(spec.source)}</div></div>`,
    chrome,
  );
}

// ------------------------------------------------------------ demo footage

// Where recorded product footage is placed for a ui_demo beat (16:9 inside the
// stage). The renderer draws this frame as a still, then overlays the screen
// recording onto DEMO_WINDOW with ffmpeg.
export const DEMO_WINDOW = { x: 128, y: 66, w: 1024, h: 576 } as const;
// With the presenter's bubble on screen the window moves left and shrinks so
// the bubble sits in the free column beside it. Still 16:9.
export const DEMO_WINDOW_WITH_FACE = { x: 48, y: 70, w: 960, h: 540 } as const;

export function demoWindow(hasFace: boolean): { x: number; y: number; w: number; h: number } {
  return hasFace ? DEMO_WINDOW_WITH_FACE : DEMO_WINDOW;
}

// windowLabel is for the review page only: it tells the reviewer what will fill
// the window. The renderer leaves it out (footage is overlaid on the window, and
// a label would show through any letterbox bars).
export function demoFrameHtml(caption: string, chrome: BeatChrome | undefined, windowLabel?: string): string {
  const label = windowLabel ? `<div class="demo-label">${escapeHtml(windowLabel)}</div>` : "";
  const win = demoWindow(chrome?.hasFace === true);
  return pageHtml(
    `<div class="demo-title">${escapeHtml(caption)}</div><div class="demo-window">${label}</div>`,
    chrome,
    `
    .demo-title { top: 24px; left: ${win.x}px; font-size: 20px; max-width: ${win.w}px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .demo-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #9199a8; font-size: 30px; text-align: center; padding: 0 80px; }
    .demo-window { position: absolute; left: ${win.x}px; top: ${win.y}px; width: ${win.w}px; height: ${win.h}px; border-radius: 14px; background: #0e1014; outline: 1px solid rgba(255,255,255,0.14); box-shadow: 0 30px 80px rgba(0,0,0,0.55); }
  `,
    { scaleStage: false },
  );
}
