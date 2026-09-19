import { spawn } from "node:child_process";

// Real bug found and fixed via direct verification (re-decoding actual
// render output), not assumed: `-vsync vfr` on a concat of sparse still
// images (one packet every ~2s+, no motion) produces a video stream real
// decoders don't reliably hold to its declared end — re-decoding a test
// render showed content stopping ~2s early even though the container
// duration (matched to the audio) claimed the full length. Beats past that
// point would never actually show. Fix: encode at a real constant frame
// rate (`-vsync cfr -r OUTPUT_FPS`) so ffmpeg explicitly duplicates each
// still image into real frames spanning its full duration — verified this
// produces a stream where every beat's color shows at exactly the right
// second, all the way to the end. Low FPS is fine (and cheap to encode,
// libx264 skips near-identical duplicate frames) since these are static
// screenshots, not motion video.
export const OUTPUT_FPS = 5;

// Needed by the real-recording render path to know a scene's actual
// recorded duration — the last beat's on-screen time runs from its
// checkpoint to the end of the real recording, not to another checkpoint.
export function getMediaDurationMs(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      const seconds = parseFloat(stdout.trim());
      if (code !== 0 || Number.isNaN(seconds)) {
        reject(new Error(`ffprobe failed on ${filePath}: ${stderr.slice(-2000)}`));
        return;
      }
      resolve(Math.round(seconds * 1000));
    });
  });
}

export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-4000)}`));
    });
  });
}
