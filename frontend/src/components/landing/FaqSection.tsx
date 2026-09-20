import { useState } from "react";
import { Search, X, Plus, Minus } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CornerMarks } from "@/components/ui/corner-marks";

export interface FaqItem {
  id: string;
  originalIdx: number;
  q: string;
  a: string;
  category: "Voice" | "Repos" | "Privacy" | "Languages" | "Access";
}

export const FAQ_DATA: FaqItem[] = [
  {
    id: "item-1",
    originalIdx: 1,
    q: "Whose voice is in the video?",
    a: "Yours. Vaani cuts visuals over your own recorded audio. An AI voice (Amazon Polly's Kajal) exists only as a fallback if you can't record.",
    category: "Voice",
  },
  {
    id: "item-2",
    originalIdx: 2,
    q: "Which repos work?",
    a: "Any public GitHub repo. Vaani reads the README, package files and a sample of source files, then drafts a script you can edit before recording.",
    category: "Repos",
  },
  {
    id: "item-3",
    originalIdx: 3,
    q: "What if I stumble or say um?",
    a: "Retake any scene. And the sync step is built for messy speech: it only moves forward through your script when a word matches, so repeats and fillers don't shift a cut.",
    category: "Voice",
  },
  {
    id: "item-4",
    originalIdx: 4,
    q: "Where do my recordings go?",
    a: "Your browser uploads each take directly to an S3 bucket in the AWS account running Vaani. They're used to transcribe and render your video.",
    category: "Privacy",
  },
  {
    id: "item-5",
    originalIdx: 5,
    q: "Which languages does it support?",
    a: "Two: Hinglish, written the way Indian developers actually talk, and plain English. Pick one before the script is drafted. Other languages aren't supported yet.",
    category: "Languages",
  },
  {
    id: "item-6",
    originalIdx: 6,
    q: "Is it free?",
    a: "Vaani is a hackathon project (First Commit, WeMakeDevs x AWS). There's no pricing yet.",
    category: "Access",
  },
];

const CATEGORIES = ["All", "Voice", "Repos", "Privacy", "Languages", "Access"] as const;

export function FaqSection() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [openValues, setOpenValues] = useState<string[]>(["item-3"]);

  const filtered = FAQ_DATA.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const qLower = item.q.toLowerCase();
    const aLower = item.a.toLowerCase();
    const sLower = search.toLowerCase();
    const matchesSearch = !search || qLower.includes(sLower) || aLower.includes(sLower);
    return matchesCategory && matchesSearch;
  });

  const allFilteredIds = filtered.map((f) => f.id);
  const isAllExpanded = allFilteredIds.length > 0 && allFilteredIds.every((id) => openValues.includes(id));

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      setOpenValues([]);
    } else {
      setOpenValues(allFilteredIds);
    }
  };

  const githubUrl = import.meta.env.VITE_GITHUB_URL;

  return (
    <div className="grid gap-10 font-mono lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-14">
      {/* Left column */}
      <div className="flex flex-col gap-5 lg:self-start">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Questions</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Short answers. No sign-up needed to read them.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions"
            className="h-9 pl-9 pr-8 text-xs font-mono border-line-strong bg-card"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Category Chips */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "rounded border px-2 py-1 text-[11px] uppercase tracking-wider transition-all cursor-pointer select-none",
                selectedCategory === cat
                  ? "border-foreground bg-foreground text-background font-semibold"
                  : "border-line-strong bg-card text-muted-foreground hover:border-foreground/50 hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line-strong pt-4 text-xs">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleExpandAll}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {isAllExpanded ? "Collapse all" : "Expand all"}
          </Button>

          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              Still stuck? Open an issue ↗
            </a>
          )}
        </div>
      </div>

      {/* Right Accordion Column */}
      <div className="flex flex-col">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded border border-line-strong bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">No questions match “{search}”.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setSelectedCategory("All");
              }}
              className="h-8 border-line-strong text-xs"
            >
              Clear search
            </Button>
          </div>
        ) : (
          <Accordion
            value={openValues}
            onValueChange={(val) => setOpenValues(Array.isArray(val) ? val : [val])}
            className="relative flex flex-col border border-line-strong bg-card divide-y divide-line-strong shadow-xs"
          >
            <CornerMarks />
            {filtered.map((item) => {
              const isOpen = openValues.includes(item.id);
              return (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className={cn(
                    "relative border-b-0 transition-colors",
                    isOpen ? "bg-accent border-l-4 border-l-primary" : "hover:bg-card hover:border-l-4 hover:border-l-foreground"
                  )}
                >
                  <AccordionTrigger className="flex w-full items-center justify-between px-5 py-4 text-left font-mono hover:no-underline cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-muted-foreground tabular">0{item.originalIdx}</span>
                      <span className="text-base font-semibold tracking-tight text-foreground">{item.q}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase border-line-strong">
                        {item.category}
                      </Badge>
                      {isOpen ? <Minus className="size-4 text-primary" /> : <Plus className="size-4 text-muted-foreground group-hover:text-foreground" />}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5 pt-1 font-mono text-sm leading-relaxed text-muted-foreground max-w-3xl">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}
