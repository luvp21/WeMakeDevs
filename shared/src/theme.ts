import { z } from "zod";

// The look of the generated slides, diagrams and charts. "dark" is the
// original editor-style look. "light" follows the Vaani website: same colors
// and the same monospace type.
export const VideoThemeSchema = z.enum(["dark", "light"]);
export type VideoTheme = z.infer<typeof VideoThemeSchema>;

export const DEFAULT_VIDEO_THEME: VideoTheme = "dark";

export const VIDEO_THEMES: Record<VideoTheme, { name: string; description: string }> = {
  dark: { name: "Dark", description: "Editor-style dark slides. Good for code-heavy videos." },
  light: { name: "Light", description: "Matches the Vaani site: light background, blue accent, monospace type." },
};
