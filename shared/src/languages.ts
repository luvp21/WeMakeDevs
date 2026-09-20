import { z } from "zod";

// What language the narration is written and spoken in. Both are written in
// Latin letters, so the teleprompter, transcript matching and sync work the
// same way for either.
export const ScriptLanguageSchema = z.enum(["hinglish", "en"]);
export type ScriptLanguage = z.infer<typeof ScriptLanguageSchema>;

export const DEFAULT_SCRIPT_LANGUAGE: ScriptLanguage = "hinglish";

export interface ScriptLanguageInfo {
  id: ScriptLanguage;
  name: string;
  description: string;
}

export const SCRIPT_LANGUAGES: Record<ScriptLanguage, ScriptLanguageInfo> = {
  hinglish: {
    id: "hinglish",
    name: "Hinglish",
    description: "Hindi and English mixed the way developers talk, written in English letters.",
  },
  en: {
    id: "en",
    name: "English",
    description: "Plain, conversational English from start to finish.",
  },
};

export const SCRIPT_LANGUAGE_LIST: ScriptLanguageInfo[] = [SCRIPT_LANGUAGES.hinglish, SCRIPT_LANGUAGES.en];
