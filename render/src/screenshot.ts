import { chromium, type Browser } from "playwright";
import { FRAME_WIDTH, FRAME_HEIGHT } from "./visuals.js";

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  browserPromise ??= chromium.launch();
  return browserPromise;
}

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

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  await browser.close();
}
