import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FACE_BUBBLE,
  FRAME_WIDTH,
  RESULT_HOLD_SHARE,
  ScriptSchema,
  clipKey,
  clipSpeed,
  demoWindow,
  previewChrome,
  recordingKey,
  slideHtml,
} from "@vaani/shared";

const chrome = { sceneTitle: "Intro", sceneIndex: 0, sceneCount: 2, beatIndex: 0, beatCount: 2 };

test("a frame with a presenter face draws the bubble ring and shrinks the stage", () => {
  const html = slideHtml("<h1>Hi</h1>", { ...chrome, hasFace: true });
  assert.match(html, /class="face-ring"/);
  assert.match(html, /transform: scale\(0\.82\)/);
});

test("a frame without a face is unchanged", () => {
  const html = slideHtml("<h1>Hi</h1>", chrome);
  assert.doesNotMatch(html, /class="face-ring"/);
  assert.doesNotMatch(html, /transform: scale\(0\.82\)/);
});

test("the shrunk stage and the demo window both stop before the bubble column", () => {
  const stageRight = FRAME_WIDTH * 0.82;
  assert.ok(stageRight <= FACE_BUBBLE.x, `stage ends at ${stageRight}, bubble starts at ${FACE_BUBBLE.x}`);
  const win = demoWindow(true);
  assert.ok(win.x + win.w <= FACE_BUBBLE.x);
  assert.equal(win.w / win.h, 16 / 9);
});

test("the bubble sits inside the frame, above the bottom bar", () => {
  assert.ok(FACE_BUBBLE.x + FACE_BUBBLE.size <= FRAME_WIDTH);
  assert.ok(FACE_BUBBLE.y + FACE_BUBBLE.size <= 720 - 48);
});

test("a demo clip is stored outside recordings/, so it can't pass for a scene take", () => {
  assert.equal(clipKey("s", "beat-3", "webm"), "clips/s/beat-3.webm");
  assert.ok(!clipKey("s", "beat-3", "webm").startsWith("recordings/"));
  assert.ok(recordingKey("s", "scene-1", "webm").startsWith("recordings/"));
});

test("a demo clip is sped up to fit its narration without losing its end", () => {
  assert.equal(clipSpeed(10, 10), 1);
  assert.equal(clipSpeed(6, 10), 1, "a shorter clip plays at normal speed and holds its last frame");
  // The whole clip is squeezed into 85% of the beat, so the result stays on screen after it.
  assert.equal(clipSpeed(20, 10), 20 / (10 * RESULT_HOLD_SHARE));
  const speed = clipSpeed(60, 10);
  assert.ok(60 / speed < 10, "the sped-up clip ends before the beat does");
  assert.ok(speed > 6, "a 60s clip over a 10s beat is flagged as too fast");
  assert.equal(clipSpeed(NaN, 10), 1);
  assert.equal(clipSpeed(10, 0), 1);
});

test("frames are dark unless the light theme is asked for", () => {
  assert.match(slideHtml("<h1>Hi</h1>", chrome), /data-theme="dark"/);
  const light = slideHtml("<h1>Hi</h1>", { ...chrome, theme: "light" });
  assert.match(light, /data-theme="light"/);
  assert.match(light, /--bg: #f7f8fa/, "uses the website's light background");
  assert.match(light, /font-family: "Geist Mono"/, "embeds the website's monospace font");
  assert.doesNotMatch(slideHtml("<h1>Hi</h1>", chrome), /font-family: "Geist Mono"/, "dark frames do not carry the font");
});

test("a themed preview has no bottom bar", () => {
  const html = slideHtml("<h1>Hi</h1>", previewChrome("light"));
  assert.match(html, /data-theme="light"/);
  assert.doesNotMatch(html, /class="chrome"/);
});

test("slide building blocks (bullets, table, stats, bars) are styled in the design system", () => {
  const html = slideHtml("<ul class=\"points\"><li>a</li></ul>", chrome);
  for (const selector of [".slide ul.points", ".slide table.data", ".slide .stats", ".slide .cols", ".slide .hbar"]) {
    assert.ok(html.includes(selector), `${selector} is styled`);
  }
});

test("scripts saved before themes existed stay dark", () => {
  const script = ScriptSchema.parse({ repo_url: "https://github.com/a/b", user_context: "", scenes: [] });
  assert.equal(script.theme, "dark");
  assert.equal(ScriptSchema.parse({ ...script, theme: "light" }).theme, "light");
});
