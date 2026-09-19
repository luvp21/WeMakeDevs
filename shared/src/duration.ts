// How long narration takes to say, so a target video length can be turned into
// a word budget for the script and a script back into an estimated length.
// 135 words per minute is measured, not assumed: Amazon Polly's Kajal read a
// real 26-word Hinglish scene in 11.4s (about 137 wpm), and a person reading
// from a prompter is in the same range.
export const WORDS_PER_MINUTE = 135;

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function estimateSeconds(text: string): number {
  return (countWords(text) / WORDS_PER_MINUTE) * 60;
}

export function wordBudget(minutes: number): number {
  return Math.round(minutes * WORDS_PER_MINUTE);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Target lengths offered in the UI, and a sensible default per format.
export const TARGET_MINUTES_OPTIONS = [0.5, 1, 2, 3, 5] as const;
export function minutesLabel(minutes: number): string {
  return minutes < 1 ? `${Math.round(minutes * 60)} sec` : `${minutes} min`;
}
