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

export function transcribeOutputKey(scriptId: string, sceneId: string): string {
  return `transcripts/${scriptId}/${sceneId}/output.json`;
}

export function syncResultKey(scriptId: string): string {
  return `sync/${scriptId}/result.json`;
}

export function transcriptionJobName(scriptId: string, sceneId: string): string {
  // Transcribe job names: alphanumeric + . _ - only, must be unique per
  // account/region. Deterministic from scriptId+sceneId so status lookups
  // don't need us to track job names separately.
  return `vaani-${scriptId}-${sceneId}`;
}
