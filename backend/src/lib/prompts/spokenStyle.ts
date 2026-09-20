import type { ScriptLanguage } from "@vaani/shared";

// What makes narration sound like a person and not a press release. It gets
// read aloud once from a teleprompter and heard once by someone who can't
// re-read it, so it is written for the ear: short, plain, one idea at a time,
// and nothing the speaker has to stop and decide how to say. The first draft of
// this app's scripts failed on exactly these points: long clause-stacked
// sentences, marketing words, code read out as syntax, and dashes and colons.
const SPOKEN_STYLE_RULES = [
  "Write for the ear. This will be read aloud by one person from a teleprompter, and the viewer hears it once. Every line must be easy to say without stopping and easy to follow without re-reading.",
  "Sentences: one idea each, usually 8 to 18 words, never more than 22. A beat is one to three short sentences. Mix in an occasional very short sentence. Start most sentences with the subject and the verb, not with a lead-in clause.",
  "No dashes, colons, semicolons, parentheses, slashes, quotation marks, bullet-like lists or symbols in the narration. Use a period or a comma. If you would reach for a dash, write two sentences.",
  "Words: pick the everyday word over the fancy one ('use', not 'leverage'). Explain a technical term in plain words the first time it appears. Never stack more than one technical noun in a row ('a regular expression with named capture groups' becomes 'a pattern that pulls out the number and the unit').",
  "Code out loud: describe what it does instead of reading syntax. Say 'you give it the text two days' and not 'ms open paren quote two days'. Use at most one code name per sentence, and only names the viewer can see on screen. Write small numbers as words, and round large ones ('about a hundred and seventy million').",
  "Say what it does and what changes for the person using it. Be specific and modest. Banned: seamless, robust, powerful, cutting-edge, game-changer, revolutionary, effortless, magic, nightmare, at scale, worldwide, trusted by millions, under the hood, dive into, unlock, supercharge, blazing fast, 'not just X, but Y', and lists of exactly three adjectives.",
  "Sound like one person talking to a colleague. No announcing what you are about to say, no rhetorical questions as filler, no repeating the previous beat. Do not begin two beats in a row with the same word. Each beat adds one new thing.",
];

// Patterns that make text sound machine-written, taken from the open-source
// "humanizer" skill (MIT), which is built on Wikipedia's "Signs of AI writing"
// guide, and trimmed to what matters in narration. Kept as prompt rules AND as
// a check on the output (machineWritingHits) so the worst of it gets a retry.
const MACHINE_WRITING_RULES = [
  "Plain verbs: say 'is' and 'has', not 'serves as', 'stands as', 'boasts', 'features' or 'offers'. Give the sentence a real subject and an active verb: 'You don't need a config file', not 'No config file needed'.",
  "No inflated importance: never say something 'plays a crucial role', 'is a testament to', 'marks a shift', 'reflects broader trends' or sits in an 'evolving landscape'. State what it does.",
  "No fake-depth endings: do not tack on '-ing' phrases like 'ensuring reliability', 'highlighting its value', 'showcasing how it works'. End the sentence when the fact ends.",
  "No 'not just X, but Y', 'not only', or clipped negative tags such as 'no guessing' or 'zero hassle'. Say what it does.",
  "No groups of three for their own sake, no 'from X to Y' when X and Y aren't a real range, and no synonym cycling: call a thing by the same name every time.",
  "No vague authorities ('experts say', 'many developers', 'industry reports'). Only claim what the repo or the user's notes say.",
  "No announcements or theatrical openers: never 'let's dive in', 'here's what you need to know', 'without further ado', 'honestly', 'here's the thing', 'the real question is', 'at its core', 'fundamentally'. Pointing at the screen is fine ('look at this line').",
  "No aphorisms ('X is the language of Y') and no staccato drama: a run of short fragments like 'No lag. No waiting. Just speed.' is out. One short sentence for emphasis is fine.",
  "No upbeat closers ('the future looks bright', 'exciting times ahead'). Close on the concrete thing to try or the next step.",
  "Cut filler and hedging: 'to' not 'in order to', 'because' not 'due to the fact that', 'can' not 'has the ability to', never 'it is important to note', never 'could potentially'.",
  "Avoid these words: additionally, crucial, delve, pivotal, tapestry, testament, underscore, vibrant, intricate, showcase, foster, garner, interplay, key (as an adjective), landscape (as a noun), valuable, align with.",
];

const ENGLISH_EXTRA = [
  "Use contractions (it's, you'll, don't) the way people do when they talk.",
];

const HINGLISH_EXTRA = [
  "Keep the Hindi part simple and spoken (dekho, matlab, ab, toh, kyunki) and use English only for the technical words, not for every other word. Do not translate technical terms into formal Hindi. Keep verbs at the end of the sentence the way people actually say them, and keep each sentence short enough to say in one breath.",
];

export function spokenStyleRules(language: ScriptLanguage): string[] {
  return [
    "Spoken style:",
    ...[...SPOKEN_STYLE_RULES, ...(language === "en" ? ENGLISH_EXTRA : HINGLISH_EXTRA)].map((r) => `- ${r}`),
    "",
    "Do not sound machine-written:",
    ...MACHINE_WRITING_RULES.map((r) => `- ${r}`),
  ];
}

// A safety net for what the prompt asks the model not to do. Dashes, colons and
// markdown are hard for a speaker to voice and show up as stray tokens in the
// teleprompter, so they become plain commas. Used only on narration Vaani writes
// itself, never on a script the user supplied (their words are kept exactly).
export function cleanNarration(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s*;\s+/g, ", ")
    .replace(/:\s+/g, ", ")
    .replace(/[`*_]{1,3}/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,\s*,/g, ",")
    .trim();
}

// Words and phrases that give narration away as machine-written. Matched
// whole-word, case-insensitive. Deliberately a short list of things that are
// nearly always filler or puffery in a narration, so a hit is worth a retry.
const MACHINE_PHRASES: RegExp[] = [
  /\badditionally\b/i, /\bcrucial\b/i, /\bdelve[sd]?\b/i, /\bpivotal\b/i, /\btapestry\b/i, /\btestament\b/i,
  /\bunderscores?\b/i, /\bvibrant\b/i, /\bintricate\b/i, /\bshowcas(?:e|es|ing)\b/i, /\bfoster(?:s|ing)?\b/i,
  /\bgarner\b/i, /\binterplay\b/i, /\bseamless(?:ly)?\b/i, /\brobust\b/i, /\bpowerful\b/i, /\bcutting[- ]edge\b/i,
  /\bgame[- ]?changer\b/i, /\brevolutionary\b/i, /\beffortless(?:ly)?\b/i, /\bgroundbreaking\b/i, /\brenowned\b/i,
  /\bunlock(?:s|ing)?\b/i, /\bsupercharge[sd]?\b/i, /\bleverag(?:e|es|ing)\b/i,
  /\bunder the hood\b/i, /\bdive into\b/i, /\blet'?s dive\b/i, /\bhere'?s the thing\b/i, /\bthe real question\b/i,
  /\bat its core\b/i, /\bfundamentally\b/i, /\bnot (?:just|only|merely)\b/i, /\bplays? an? (?:crucial|key|vital|pivotal) role\b/i,
  /\b(?:serves|stands) as\b/i, /\bevolving landscape\b/i, /\bfuture looks bright\b/i, /\btrusted by millions\b/i,
  /\bin order to\b/i, /\bdue to the fact\b/i, /\bit is important to note\b/i, /\bwithout further ado\b/i,
  /\bworldwide\b/i, /\bat scale\b/i, /\bcould potentially\b/i, /\bhonestly\b/i,
];

// The distinct machine-sounding words and phrases found in a piece of narration.
export function machineWritingHits(text: string): string[] {
  const hits = new Set<string>();
  for (const pattern of MACHINE_PHRASES) {
    const match = pattern.exec(text);
    if (match) hits.add(match[0].toLowerCase());
  }
  return [...hits];
}
