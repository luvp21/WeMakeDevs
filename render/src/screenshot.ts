import path from "node:path";
import { chromium, type Browser } from "playwright";
import { FRAME_WIDTH, FRAME_HEIGHT } from "./visuals.js";

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  browserPromise ??= chromium.launch();
  return browserPromise;
}

// How long each beat's entrance animation plays, and at what frame rate it is
// captured. After the intro the settled final state is simply held.
export const INTRO_SECONDS = 1.3;
export const CAPTURE_FPS = 30;

export async function screenshotHtml(html: string, outPath: string): Promise<void> {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: FRAME_WIDTH, height: FRAME_HEIGHT } });
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.screenshot({ path: outPath });
  } finally {
    await page.close();
  }
}

// Captures a beat's entrance animation as a numbered image sequence
// (frame_000.jpg ...) by pausing every CSS animation and stepping its clock,
// rather than screenshotting in real time — so the result is exact and
// repeatable regardless of how slow the render machine is. Returns the
// frame count. The last frame is the fully settled state.
export async function captureBeatFrames(html: string, outDir: string): Promise<number> {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: FRAME_WIDTH, height: FRAME_HEIGHT } });
  const frameCount = Math.round(INTRO_SECONDS * CAPTURE_FPS) + 1;
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    for (let i = 0; i < frameCount; i++) {
      const timeMs = (i / CAPTURE_FPS) * 1000;
      await page.evaluate((t) => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = t;
        }
      }, timeMs);
      const file = path.join(outDir, `frame_${String(i).padStart(3, "0")}.jpg`);
      await page.screenshot({ path: file, type: "jpeg", quality: 92 });
    }
    return frameCount;
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  await browser.close();
}
