import { spawn } from "node:child_process";

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

// True when the file has a video track at all. A recording made without a
// camera (or an audio-only one) has none, and then there is no face to show.
export function hasVideoStream(filePath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v",
      "-show_entries", "stream=codec_type",
      "-of", "csv=p=0",
      filePath,
    ]);
    let stdout = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", () => resolve(stdout.trim().length > 0));
  });
}
