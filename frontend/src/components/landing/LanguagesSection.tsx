import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Play, Square } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const HINGLISH_LINES = [
  "Aaj hum dekh rahe hain Vercel ka super popular package ms, jo time strings aur milliseconds ke beech smooth conversions karta hai.",
  "Sabse pehle iska main export dekho, function overloading use karke ye single function dono directions handle karta hai.",
  "Simple si baat hai: agar input string aayi toh parse karega, number aaya toh format karega, warna seedha error throw.",
];

export const ENGLISH_LINES = [
  "Today we're looking at Vercel's popular package ms, which converts smoothly between time strings and milliseconds.",
  "First, look at its main export. Using function overloading, this single function handles both directions.",
  "It's simple: if it gets an input string, it parses it. If it gets a number, it formats it. Otherwise it throws an error.",
];

export const ENGLISH_TERMS = new Set(
  "super popular package ms time strings milliseconds smooth conversions main export function overloading use single directions handle input string parse number format error throw".split(" ")
);

const WORD_MS = 360;

function HighlightedHinglishLine({
  text,
  activeWordIdx,
  lineOffset,
}: {
  text: string;
  activeWordIdx: number | null;
  lineOffset: number;
}) {
  const words = text.split(" ");
  return (
    <p className="text-sm leading-relaxed sm:text-base text-foreground font-mono">
      {words.map((word, i) => {
        const clean = word.toLowerCase().replace(/[^a-z]/g, "");
        const globalIdx = lineOffset + i;
        const isReadingCurrent = activeWordIdx === globalIdx;
        const isEnglish = ENGLISH_TERMS.has(clean);

        const wordNode = (
          <span
            key={i}
            className={cn(
              "inline-block rounded px-1 transition-all duration-150",
              isReadingCurrent && "bg-highlight-soft text-foreground font-semibold border-b-2 border-highlight",
              !isReadingCurrent && isEnglish && "text-primary font-medium",
              !isReadingCurrent && !isEnglish && "text-foreground"
            )}
          >
            {word}{" "}
          </span>
        );

        if (isEnglish) {
          return (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger render={<span className="cursor-help">{wordNode}</span>} />
                <TooltipContent className="font-mono text-xs">kept in English</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }

        return wordNode;
      })}
    </p>
  );
}

function PlainEnglishLine({
  text,
  activeWordIdx,
  lineOffset,
}: {
  text: string;
  activeWordIdx: number | null;
  lineOffset: number;
}) {
  const words = text.split(" ");
  return (
    <p className="text-sm leading-relaxed text-foreground sm:text-base font-mono">
      {words.map((word, i) => {
        const globalIdx = lineOffset + i;
        const isReadingCurrent = activeWordIdx === globalIdx;
        return (
          <span
            key={i}
            className={cn(
              "inline-block rounded px-1 transition-all duration-150",
              isReadingCurrent && "bg-highlight-soft text-foreground font-semibold border-b-2 border-highlight"
            )}
          >
            {word}{" "}
          </span>
        );
      })}
    </p>
  );
}

export function LanguagesSection() {
  const [viewMode, setViewMode] = useState<"parallel" | "single">("parallel");
  const [singleTab, setSingleTab] = useState<"hinglish" | "english">("hinglish");
  const [isReading, setIsReading] = useState(false);
  const [readWordIdx, setReadWordIdx] = useState<number | null>(null);

  const activeLines = singleTab === "hinglish" ? HINGLISH_LINES : ENGLISH_LINES;
  const totalWords = activeLines.join(" ").split(" ").length;

  // Read Aloud animation loop
  useEffect(() => {
    if (!isReading) {
      setReadWordIdx(null);
      return;
    }

    setReadWordIdx(0);
    const interval = setInterval(() => {
      setReadWordIdx((idx) => {
        if (idx === null || idx >= totalWords - 1) {
          setIsReading(false);
          return null;
        }
        return idx + 1;
      });
    }, WORD_MS);

    return () => clearInterval(interval);
  }, [isReading, totalWords]);

  return (
    <div className="flex flex-col gap-5 font-mono">
      <div className="flex flex-col gap-6 rounded-md border border-line-strong bg-card p-6 shadow-xs sm:p-8">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-strong pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "parallel" | "single")} className="w-auto">
              <TabsList className="bg-secondary p-0.5 border border-line-strong">
                <TabsTrigger value="parallel" className="text-xs font-semibold">
                  Parallel (Side by Side)
                </TabsTrigger>
                <TabsTrigger value="single" className="text-xs">
                  Single Tab
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {viewMode === "single" && (
              <Tabs value={singleTab} onValueChange={(v) => setSingleTab(v as "hinglish" | "english")} className="w-auto">
                <TabsList className="bg-secondary p-0.5 border border-line-strong">
                  <TabsTrigger value="hinglish" className="gap-1.5 text-xs">
                    Hinglish
                    <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-card border border-line-strong">
                      Default
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="english" className="text-xs">
                    English
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary" />
                English term kept
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-foreground" />
                Hinglish phrasing
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsReading((r) => !r)}
              className="h-8 text-xs gap-1.5 border border-line-strong hover:bg-accent"
            >
              {isReading ? <Square className="size-3 text-destructive" /> : <Play className="size-3 text-primary" />}
              {isReading ? "Stop" : "▶ Read aloud"}
            </Button>
          </div>
        </div>

        {/* Parallel Mode (Default): 2 Separated Columns (English vs Hinglish) */}
        {viewMode === "parallel" ? (
          <div className="flex flex-col gap-6">
            {/* Column Headers */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line-strong border-b border-line-strong pb-3">
              <div className="flex items-center justify-between font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-2 md:pb-0 md:pr-6">
                <span>1. English (Original)</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">EN</span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs font-semibold uppercase tracking-wider text-foreground pt-2 md:pt-0 md:pl-6">
                <span>2. Hinglish (Drafted)</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[9px] bg-primary-soft text-primary border border-primary/30">
                  Default Output
                </Badge>
              </div>
            </div>

            {/* Parallel Rows with visible vertical border between columns */}
            <div className="flex flex-col gap-6">
              {ENGLISH_LINES.map((engLine, idx) => {
                const hinglishLine = HINGLISH_LINES[idx];
                const engOffset = idx === 0 ? 0 : ENGLISH_LINES.slice(0, idx).join(" ").split(" ").length;
                const hinglishOffset = idx === 0 ? 0 : HINGLISH_LINES.slice(0, idx).join(" ").split(" ").length;

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-2 border-b border-line-strong/60 pb-6 last:border-b-0 last:pb-0 md:items-stretch"
                  >
                    {/* Left Column: English (with right border boundary) */}
                    <div className="rounded-l border border-line-strong/80 bg-secondary/30 p-4 md:border-r-2 md:border-r-line-strong">
                      <PlainEnglishLine text={engLine} activeWordIdx={readWordIdx} lineOffset={engOffset} />
                    </div>

                    {/* Right Column: Hinglish */}
                    <div className="rounded-r border border-line-strong bg-card p-4 shadow-xs md:border-l-0">
                      <HighlightedHinglishLine text={hinglishLine} activeWordIdx={readWordIdx} lineOffset={hinglishOffset} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Single Tab View */
          <motion.div
            key={singleTab}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-5 pt-2"
          >
            {singleTab === "hinglish"
              ? HINGLISH_LINES.map((line, lineIdx) => {
                  const currentLineOffset = lineIdx === 0 ? 0 : HINGLISH_LINES.slice(0, lineIdx).join(" ").split(" ").length;
                  return (
                    <HighlightedHinglishLine
                      key={line}
                      text={line}
                      activeWordIdx={readWordIdx}
                      lineOffset={currentLineOffset}
                    />
                  );
                })
              : ENGLISH_LINES.map((line, lineIdx) => {
                  const currentLineOffset = lineIdx === 0 ? 0 : ENGLISH_LINES.slice(0, lineIdx).join(" ").split(" ").length;
                  return (
                    <PlainEnglishLine
                      key={line}
                      text={line}
                      activeWordIdx={readWordIdx}
                      lineOffset={currentLineOffset}
                    />
                  );
                })}
          </motion.div>
        )}

        <p className="mt-2 text-xs text-muted-foreground border-t border-line-strong pt-3">
          Drafted from the vercel/ms repo. <span className="text-primary font-semibold">Blue</span> is English term kept intact.
        </p>
      </div>
    </div>
  );
}
