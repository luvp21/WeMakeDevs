// Loose word comparison for the two-pointer sync walk — never require exact
// string equality (see docs/SYNC_ALGORITHM.md). Lowercase + strip
// punctuation, then allow a proportional fuzzy match.
//
// The proportional (not fixed) threshold specifically exists for
// transliterated Devanagari→Latin transcript text (see transliterate.ts):
// confirmed empirically against a real Transcribe job that romanization
// noise ("yahaan" vs script's "yahan", "karataa" vs "karta") commonly runs
// 1-2 edits even on longer words — a fixed short-word-only threshold missed
// most of these. Loanwords Transcribe respells phonetically in Devanagari
// ("async" -> "एसिंक" -> "esimka") are a separate, harder problem this
// threshold deliberately does NOT try to bridge (the edit distance is much
// larger and matching them would risk false positives on unrelated words);
// those are expected to fall to the sync algorithm's stall-skip fallback.

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, (_, i) => [
    i,
    ...Array<number>(cols - 1).fill(0),
  ]);
  for (let j = 1; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1, // deletion
        dist[i][j - 1] + 1, // insertion
        dist[i - 1][j - 1] + cost, // substitution
      );
    }
  }
  return dist[rows - 1][cols - 1];
}

// MIN was 1 — raised to 2 after a real Whisper transcript showed Sanscript's
// `syncope: true` doesn't reliably drop the trailing schwa on short words
// ("हम" -> "hama", not "ham"; confirmed directly against the library, not
// assumed), so a 4-char transliterated word can land 2 edits from its
// correct script-side spelling. 1 was too tight for that whole word class.
const MIN_EDIT_DISTANCE_ALLOWANCE = 2;
const EDIT_DISTANCE_PROPORTION = 0.34; // roughly 1 edit per 3 characters

function maxAllowedEditDistance(length: number): number {
  return Math.max(MIN_EDIT_DISTANCE_ALLOWANCE, Math.floor(length * EDIT_DISTANCE_PROPORTION));
}

export function wordsMatch(scriptWord: string, transcriptWord: string): boolean {
  const a = normalize(scriptWord);
  const b = normalize(transcriptWord);
  if (!a || !b) return a === b;
  if (a === b) return true;
  const threshold = maxAllowedEditDistance(Math.max(a.length, b.length));
  return levenshtein(a, b) <= threshold;
}
