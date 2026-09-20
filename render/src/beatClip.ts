import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { runFfmpeg } from "./ffmpeg.js";
import { demoWindow } from "@vaani/shared";
import { captureBeatFrames, screenshotHtml, CAPTURE_FPS } from "./screenshot.js";

// Turns per-beat durations in seconds into whole frame counts whose running
// total never drifts from the real total. Rounding each beat on its own would
// let up to half a frame of error pile up per beat; rounding the cumulative
// boundaries instead keeps every cut within half a frame of where it belongs.
export function frameCounts(durationsSeconds: number[]): number[] {
  const counts: number[] = [];
  let elapsed = 0;
  let framesSoFar = 0;
  for (const duration of durationsSeconds) {
    elapsed += duration;
    const boundary = Math.round(elapsed * CAPTURE_FPS);
    counts.push(Math.max(1, boundary - framesSoFar));
    framesSoFar += counts[counts.length - 1];
  }
  return counts;
}

// Renders one beat as a real constant-frame-rate clip: its entrance animation
// as captured frames, then the settled last frame held out to the beat's
// length. Every held frame is a genuine frame (tpad clone), not a sparse
// timestamp — the same reason ffmpeg.ts's OUTPUT_FPS note gives for never
// using variable frame rate here (decoders cut off sparse still-image video).
export async function renderBeatClip(params: {
  html: string;
  frames: number;
  workDir: string;
  id: string;
}): Promise<string> {
  const { html, frames, workDir, id } = params;
  const frameDir = path.join(workDir, `${id}-frames`);
  await mkdir(frameDir, { recursive: true });
  const captured = await captureBeatFrames(html, frameDir);

  const clipPath = path.join(workDir, `${id}.mp4`);
  const holdFrames = Math.max(0, frames - captured);
  await runFfmpeg([
    "-framerate", String(CAPTURE_FPS),
    "-i", path.join(frameDir, "frame_%03d.jpg"),
    "-vf", `tpad=stop_mode=clone:stop=${holdFrames},format=yuv420p`,
    "-frames:v", String(frames),
    "-r", String(CAPTURE_FPS),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    clipPath,
  ]);
  return clipPath;
}

// Joins a scene's beat clips (video stream copied, they share encoder
// settings) and lays the scene's audio underneath. `-shortest` keeps the
// scene at the real audio length, same as before.
export async function assembleScene(params: {
  clipPaths: string[];
  audioPath: string;
  outPath: string;
  workDir: string;
  sceneId: string;
}): Promise<void> {
  const { clipPaths, audioPath, outPath, workDir, sceneId } = params;
  const listPath = path.join(workDir, `${sceneId}-clips.txt`);
  await writeFile(listPath, clipPaths.map((p) => `file '${p}'`).join("\n"));
  await runFfmpeg([
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    "-i", audioPath,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "aac",
    "-shortest",
    outPath,
  ]);
}

// A ui_demo beat with real footage: the presenter's silent screen clip for this
// step, sped up if it is longer than the narration and framed like the other visuals (same
// dark background and bottom bar). frameHtml is the framing page from
// demoFrameHtml(); the footage is scaled to fit demoWindow(), letterboxed if it
// isn't 16:9.
export async function renderFootageClip(params: {
  frameHtml: string;
  hasFace: boolean;
  clipPath: string;
  // 1 plays at normal speed; higher speeds it up (see clipSpeed in shared). A clip
  // that ends before the beat holds its last frame.
  speed: number;
  frames: number;
  workDir: string;
  id: string;
}): Promise<string> {
  const { frameHtml, hasFace, clipPath: footagePath, speed, frames, workDir, id } = params;
  const framePath = path.join(workDir, `${id}-frame.png`);
  await screenshotHtml(frameHtml, framePath);

  const { x, y, w, h } = demoWindow(hasFace);
  const clipPath = path.join(workDir, `${id}.mp4`);
  await runFfmpeg([
    "-loop", "1", "-framerate", String(CAPTURE_FPS), "-i", framePath,
    "-i", footagePath,
    "-filter_complex",
    `[1:v]setpts=PTS/${speed.toFixed(4)},fps=${CAPTURE_FPS},scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0e1014,setsar=1[v];` +
      `[0:v][v]overlay=${x}:${y}:eof_action=repeat,format=yuv420p[out]`,
    "-map", "[out]",
    "-frames:v", String(frames),
    "-r", String(CAPTURE_FPS),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    clipPath,
  ]);
  return clipPath;
}
