import { z } from "zod";

// The kinds of video Vaani can make. One source of truth for the format
// picker (frontend), the script-generation prompt (backend), and what the
// studio tells the user to expect (does this format need a screen share?).
export const VideoFormatIdSchema = z.enum([
  "code_walkthrough",
  "hackathon_demo",
  "product_demo",
  "architecture_overview",
  "launch_teaser",
]);
export type VideoFormatId = z.infer<typeof VideoFormatIdSchema>;

export interface VideoFormatScene {
  title: string;
  purpose: string;
}

export interface VideoFormat {
  id: VideoFormatId;
  name: string;
  tagline: string;
  length: string;
  // Default target length in minutes for this format.
  defaultMinutes: number;
  // "required": the format is built around showing the running product.
  screenShare: "required" | "optional" | "none";
  scenes: VideoFormatScene[];
  // Plain-language direction for what mix of visuals to use.
  visualMix: string;
  tone: string;
}

export const VIDEO_FORMATS: Record<VideoFormatId, VideoFormat> = {
  code_walkthrough: {
    id: "code_walkthrough",
    name: "Code walkthrough",
    tagline: "Explain how the code works, file by file.",
    length: "3-5 min",
    defaultMinutes: 3,
    screenShare: "none",
    scenes: [
      { title: "What it is", purpose: "One slide: what this project does and why anyone would use it." },
      { title: "The entry point", purpose: "Show the main function or file and what happens first." },
      { title: "How the core logic works", purpose: "Walk the important code; add one diagram if there's a flow to show." },
      { title: "A design choice worth noticing", purpose: "One decision in the code that's clever or non-obvious, and why." },
      { title: "How to use it", purpose: "A short usage slide with the real API." },
    ],
    visualMix:
      "About 60% code_highlight beats on real files, 1 diagram if there is a real flow, the rest slides. Every code beat must point at real lines from the provided files.",
    tone: "A friendly senior engineer explaining code to a colleague. Concrete, unhurried.",
  },
  hackathon_demo: {
    id: "hackathon_demo",
    name: "Hackathon demo",
    tagline: "A pitch built to win: problem, live product, how it's built.",
    length: "2-3 min",
    defaultMinutes: 2,
    screenShare: "required",
    scenes: [
      { title: "The problem", purpose: "Open with the pain in one or two punchy statements. No greeting, no project name yet." },
      { title: "The solution", purpose: "Name the product and say what it does in one line, then why it's different." },
      { title: "Live demo", purpose: "The product working. 2-3 ui_demo beats, each one specific action the viewer sees." },
      { title: "How it works", purpose: "An architecture diagram of the real system, narrated left to right." },
      { title: "Under the hood", purpose: "At most two code beats on the cleverest real code, plus the tech (name AWS services if the repo uses them)." },
      { title: "Impact and next", purpose: "Real results only, then one closing statement and where to try it." },
    ],
    visualMix:
      "Big-statement slides for the hook and close, ui_demo beats for the product (about 30%), one diagram, at most two code beats, and a chart only if the repo or the user's notes contain real numbers.",
    tone: "Confident and energetic, judges as the audience. Show, don't tell. Short sentences, concrete nouns, no filler like 'in this video'.",
  },
  product_demo: {
    id: "product_demo",
    name: "Product demo",
    tagline: "Tour the product for the people who'd use it.",
    length: "2-3 min",
    defaultMinutes: 2,
    screenShare: "required",
    scenes: [
      { title: "The pain", purpose: "One statement about the problem the user has today." },
      { title: "The product", purpose: "What it is in one sentence and who it's for." },
      { title: "Workflow one", purpose: "The main thing users do, shown live (ui_demo)." },
      { title: "Workflow two", purpose: "A second key capability, shown live (ui_demo)." },
      { title: "Why it's better", purpose: "The two or three reasons that matter, as a clean slide." },
      { title: "Get started", purpose: "One clear next step." },
    ],
    visualMix:
      "About 60% ui_demo beats, the rest statement/benefit slides. Little or no code; if there is an architecture, at most one simple diagram.",
    tone: "Warm and benefit-led, written for users, not engineers. Avoid jargon; name the outcome, not the implementation.",
  },
  architecture_overview: {
    id: "architecture_overview",
    name: "Architecture overview",
    tagline: "How the system fits together, for engineers.",
    length: "3-4 min",
    defaultMinutes: 3,
    screenShare: "none",
    scenes: [
      { title: "The big picture", purpose: "A system diagram of the main components and how they connect." },
      { title: "How data flows", purpose: "A second diagram following one request or job end to end." },
      { title: "The key components", purpose: "Two code beats on the parts that matter most." },
      { title: "Decisions and tradeoffs", purpose: "What was chosen over what, and why, as clean slides." },
      { title: "Limits and what's next", purpose: "What it doesn't do yet and where it goes." },
    ],
    visualMix:
      "About 40% diagrams (real components only), 30% code_highlight, the rest slides. Diagram nodes must be things that exist in the repo.",
    tone: "Engineer to engineer. Precise, honest about tradeoffs, no marketing.",
  },
  launch_teaser: {
    id: "launch_teaser",
    name: "Launch teaser",
    tagline: "A 45-second punchy intro.",
    length: "30-60 sec",
    defaultMinutes: 0.5,
    screenShare: "optional",
    scenes: [
      { title: "Hook", purpose: "One line that makes the viewer care." },
      { title: "What it does", purpose: "Two or three fast moments showing the product or its result." },
      { title: "Call to action", purpose: "Name and where to get it." },
    ],
    visualMix:
      "Mostly big-statement slides, optionally one short ui_demo moment. No code, no charts. Keep every beat to a single short sentence.",
    tone: "Punchy and quick. Ten words or fewer per beat.",
  },
};

export const VIDEO_FORMAT_LIST: VideoFormat[] = VideoFormatIdSchema.options.map((id) => VIDEO_FORMATS[id]);
