// S3 key naming conventions shared between backend (writes locked scripts,
// narration) and render (reads them, writes the final video) — these are
// separate codebases/workspaces, so keeping the convention in one place
// avoids a silent key-mismatch typo between them.

export function lockedScriptKey(scriptId: string): string {
  return `scripts/${scriptId}.json`;
}

export function narrationResultKey(scriptId: string): string {
  return `narration/${scriptId}/result.json`;
}

export function sceneAudioKey(scriptId: string, sceneId: string): string {
  return `narration/${scriptId}/${sceneId}.mp3`;
}

export function renderStatusKey(scriptId: string): string {
  return `renders/${scriptId}/status.json`;
}

export function renderVideoKey(scriptId: string): string {
  return `renders/${scriptId}/final.mp4`;
}

export function recordingKey(scriptId: string, sceneId: string, extension: string): string {
  return `recordings/${scriptId}/${sceneId}.${extension}`;
}

// A silent screen clip of one product-demo step (one ui_demo beat), recorded on
// its own before the narration. Kept out of recordings/ so it is never mistaken
// for a scene's narration take.
export function clipKey(scriptId: string, beatId: string, extension: string): string {
  return `clips/${scriptId}/${beatId}.${extension}`;
}

export function transcribeOutputKey(scriptId: string, sceneId: string): string {
  return `transcripts/${scriptId}/${sceneId}/output.json`;
}

export function syncResultKey(scriptId: string): string {
  return `sync/${scriptId}/result.json`;
}

