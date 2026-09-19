import type { ProjectStage } from "@vaani/shared";

export const STAGE_LABEL: Record<ProjectStage, string> = {
  scripted: "Script locked",
  recording: "Recording",
  synced: "Ready to render",
  rendering: "Rendering",
  done: "Video ready",
  error: "Render failed",
};

// How many of the five pipeline steps (repo, script, record, sync, video) are
// finished, for the dashboard's mini progress indicator.
export const STAGE_STEPS_DONE: Record<ProjectStage, number> = {
  scripted: 2,
  recording: 2,
  synced: 4,
  rendering: 4,
  done: 5,
  error: 4,
};

export const STAGE_ACTION: Record<ProjectStage, string> = {
  scripted: "Start recording",
  recording: "Continue recording",
  synced: "Render video",
  rendering: "View progress",
  done: "Watch video",
  error: "Retry render",
};

export function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
