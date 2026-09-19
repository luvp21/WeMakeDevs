import Sanscript from "@indic-transliteration/sanscript";
import type { TranscriptWord } from "@vaani/shared";

// AWS Transcribe's hi-IN / multi-language output comes back in Devanagari
// script ("तो यहाँ पे देखो..."), but locked scripts are written in romanized
// Hinglish ("Toh yahan pe dekho...") — confirmed empirically against a real
// Transcribe job, not assumed. The two-pointer sync algorithm's text
// matching can't work across scripts, so transcript text is transliterated
// back to Latin before it ever reaches wordsMatch(). ITRANS with syncope
// (Hindi-style schwa deletion — "ajay" not "ajaya") and these alternates
// gets closest to how Hinglish is actually spelled casually; the fuzzy
// matcher in matches.ts absorbs whatever small differences remain.
const PREFERRED_ALTERNATES = {
  itrans: { A: "aa", I: "ii", U: "uu", "~n": "n", M: "m" },
};

const DEVANAGARI_RANGE = /[ऀ-ॿ]/;

export function devanagariToLatin(text: string): string {
  return Sanscript.t(text, "devanagari", "itrans", {
    syncope: true,
    preferred_alternates: PREFERRED_ALTERNATES,
  });
}

// Applied once, up front, to a whole scene's real Transcribe/Whisper output
// before it reaches syncScene() — keeps syncScene itself script-agnostic.
// Real bug found and fixed here: Sanscript.t does NOT safely no-op on
// already-Latin text as originally assumed above — confirmed against real
// Whisper output where "API" (all-caps, no Devanagari in it at all) came
// back as "aaPii", because ITRANS treats capital A/I as long-vowel codes
// and our own preferred_alternates table remaps them. Invisible under AWS
// Transcribe (which never gave us clean Latin acronyms to mangle in the
// first place) but a real corruption of Whisper's already-correct English
// loanwords. Fix: only run words that actually contain Devanagari code
// points through Sanscript at all; anything already Latin passes through
// completely untouched.
export function transliterateTranscript(words: TranscriptWord[]): TranscriptWord[] {
  return words.map((word) => ({
    ...word,
    text: DEVANAGARI_RANGE.test(word.text) ? devanagariToLatin(word.text) : word.text,
  }));
}
