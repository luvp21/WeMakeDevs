import { FACE_BUBBLE } from "@vaani/shared";
import { CAPTURE_FPS } from "./screenshot.js";
import { runFfmpeg } from "./ffmpeg.js";

// The filter graph that turns the presenter's camera into the round bubble and
// lays it over the scene video. Kept separate from the ffmpeg call so it can be
// checked without running ffmpeg.
//
// - fps: webcam recordings are variable frame rate; forcing a constant rate is
//   the same fix that stopped stills being cut off early (see beatClip.ts).
// - crop: a centered square, so any camera aspect ratio fills the circle.
// - geq alpha: a circle mask, opaque inside the radius and clear outside.
function faceOverlayFilter(): string {
  const { x, y, size } = FACE_BUBBLE;
  const mask = `if(lte(hypot(X-W/2,Y-H/2),W/2),255,0)`;
  return (
    `[1:v]fps=${CAPTURE_FPS},crop='min(iw,ih)':'min(iw,ih)',scale=${size}:${size},setsar=1,format=yuva420p,` +
    `geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='${mask}'[face];` +
    `[0:v][face]overlay=${x}:${y}:eof_action=pass,format=yuv420p[out]`
  );
}

// Re-encodes the finished scene with the presenter's bubble on it. Audio is
// copied untouched, so the voice stays exactly as recorded.
export async function overlayFace(params: { scenePath: string; facePath: string; outPath: string }): Promise<void> {
  const { scenePath, facePath, outPath } = params;
  await runFfmpeg([
    "-i", scenePath,
    "-i", facePath,
    "-filter_complex", faceOverlayFilter(),
    "-map", "[out]",
    "-map", "0:a:0",
    "-r", String(CAPTURE_FPS),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-c:a", "copy",
    outPath,
  ]);
}
