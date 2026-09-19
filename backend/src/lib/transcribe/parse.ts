import type { TranscriptWord } from "@vaani/shared";

// AWS Transcribe's raw output shape (the subset we care about). start_time/
// end_time are seconds-as-strings; punctuation items have no timing at all.
interface TranscribeOutputItem {
  type: "pronunciation" | "punctuation";
  start_time?: string;
  end_time?: string;
  alternatives: { content: string; confidence?: string }[];
}

interface TranscribeOutput {
  results: {
    items: TranscribeOutputItem[];
  };
}

export function parseTranscribeOutput(raw: unknown): TranscriptWord[] {
  const output = raw as TranscribeOutput;
  return output.results.items
    .filter((item): item is TranscribeOutputItem & { start_time: string; end_time: string } =>
      item.type === "pronunciation" && item.start_time !== undefined && item.end_time !== undefined,
    )
    .map((item) => ({
      text: item.alternatives[0]?.content ?? "",
      start_ms: Math.round(parseFloat(item.start_time) * 1000),
      end_ms: Math.round(parseFloat(item.end_time) * 1000),
    }));
}
