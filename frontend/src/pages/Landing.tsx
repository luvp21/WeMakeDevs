import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router";
import { ArrowRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { PipelineTabs } from "@/components/landing/PipelineTabs";
import { SyncExplainer } from "@/components/landing/SyncExplainer";

/*
  THESIS: the product's one real trick, shown live in the first viewport: a
  spoken line advances word by word and the visual cuts on the exact word.
  Refuses the SaaS hero (gradient, feature cards, fake logos and quotes).
  OWN-WORLD: an editor at night. Blue-slate surfaces, hairline borders, amber
  marks "the word being spoken", blue is the only action color.
  STORY: you read your own script aloud; Vaani finds when you said each beat
  and cuts the video for you. The visitor tries it in the dashboard.
  FIRST VIEWPORT: nav; left, headline + one primary action; right, the live
  sync demo at 16:9 with the transcript and waveform under it.
  FORM: hero + interactive sequence + algorithm explainer + FAQ.
*/

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#sync", label: "Sync" },
  { href: "#hinglish", label: "Hinglish" },
  { href: "#faq", label: "FAQ" },
];

const HINGLISH_LINES = [
  "Aaj hum dekh rahe hain Vercel ka super popular package ms, jo time strings aur milliseconds ke beech smooth conversions karta hai.",
  "Sabse pehle iska main export dekho, function overloading use karke ye single function dono directions handle karta hai.",
  "Simple si baat hai: agar input string aayi toh parse karega, number aaya toh format karega, warna seedha error throw.",
];
const ENGLISH_TERMS = new Set(
  "super popular package ms time strings milliseconds smooth conversions main export function overloading use single directions handle input string parse number format error throw".split(" "),
);

const STACK: { part: string; tech: string; note: string }[] = [
  { part: "Read the repo", tech: "GitHub API", note: "README, package files, sampled source" },
  { part: "Write the script", tech: "Gemini", note: "Beat-tagged Hinglish with a visual per beat" },
  { part: "Hear you", tech: "Whisper large-v3", note: "Keeps English terms intact in Hindi speech" },
  { part: "Match voice to script", tech: "Two-pointer sync", note: "Plain TypeScript, no ML alignment model" },
  { part: "Cut the video", tech: "Playwright + FFmpeg", note: "Rendered on AWS Fargate, never on Lambda" },
  { part: "Store and serve", tech: "S3, Lambda, API Gateway", note: "Recordings upload straight from your browser to S3" },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Whose voice is in the video?",
    a: "Yours. Vaani cuts visuals over your own recorded audio. An AI voice (Amazon Polly's Kajal) exists only as a fallback if you can't record.",
  },
  {
    q: "Which repos work?",
    a: "Any public GitHub repo. Vaani reads the README, package files and a sample of source files, then drafts a script you can edit before recording.",
  },
  {
    q: "What if I stumble or say um?",
    a: "Retake any scene. And the sync step is built for messy speech: it only moves forward through your script when a word matches, so repeats and fillers don't shift a cut.",
  },
  {
    q: "Where do my recordings go?",
    a: "Your browser uploads each take directly to an S3 bucket in the AWS account running Vaani. They're used to transcribe and render your video.",
  },
  {
    q: "Which languages does it support?",
    a: "Two: Hinglish, written the way Indian developers actually talk, and plain English. Pick one before the script is drafted. Other languages aren't supported yet.",
  },
  {
    q: "Is it free?",
    a: "Vaani is a hackathon project (First Commit, WeMakeDevs x AWS). There's no pricing yet.",
  },
];

function HighlightedLine({ text }: { text: string }) {
  return (
    <p className="text-lg leading-relaxed sm:text-xl">
      {text.split(" ").map((word, i) => {
        const clean = word.toLowerCase().replace(/[^a-z]/g, "");
        return (
          <span key={i} className={ENGLISH_TERMS.has(clean) ? "text-primary" : undefined}>
            {word}{" "}
          </span>
        );
      })}
    </p>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Vaani home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button render={<Link to="/app" />} variant="ghost" size="sm" className="hidden sm:inline-flex">
            Dashboard
          </Button>
          <Button render={<Link to="/app/studio" />} size="sm">
            Make a video
          </Button>
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Vaani</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose key={link.href} render={<a href={link.href} className="rounded-md px-3 py-2.5 text-base hover:bg-accent" />}>
                    {link.label}
                  </SheetClose>
                ))}
                <SheetClose render={<Link to="/app" className="rounded-md px-3 py-2.5 text-base hover:bg-accent" />}>
                  Dashboard
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  const headline = ["Read", "your", "code", "aloud.", "Get", "the", "video."];
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:linear-gradient(to_right,oklch(1_0_0/6%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/6%)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-14 lg:py-24">
        <div className="flex flex-col gap-6">
          <h1 className="text-5xl leading-[1.04] font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            {headline.map((word, i) => (
              <motion.span
                key={i}
                className="mr-[0.25em] inline-block"
                initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.05 + i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                {word}
              </motion.span>
            ))}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground sm:text-xl">
            Paste a GitHub repo, read the Hinglish script Vaani drafts, and it cuts the code, slides and diagrams in on
            the exact words you say.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button render={<Link to="/app/studio" />} size="lg" className="h-11 px-5 text-base">
              Make a video
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button render={<a href="#sync" />} variant="ghost" size="lg" className="h-11 px-4 text-base">
              See how it syncs
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Works with any public repo. Nothing to install.</p>
        </div>
        <HeroDemo />
      </div>
    </section>
  );
}

function SectionHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p className="text-lg text-muted-foreground">{children}</p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen scroll-smooth">
      <Nav />
      <main>
        <Hero />

        <section id="how" className="scroll-mt-16 border-t">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6">
            <SectionHeading title="From repo to finished video in five steps">
              You supply the one thing software can't fake: your voice, reading it your way.
            </SectionHeading>
            <PipelineTabs />
          </div>
        </section>

        <section id="sync" className="scroll-mt-16 border-t bg-sidebar">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-16">
            <div className="flex flex-col gap-5">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">The cut lands on the word you said</h2>
              <p className="text-lg text-muted-foreground">
                Speech-to-text is messy. Your script isn't. Vaani walks both side by side and only moves the script
                forward when a word matches, so a stutter or a filler can't drag a cut off target.
              </p>
              <p className="text-muted-foreground">
                Hindi words come back spelled phonetically, so matching is fuzzy on purpose. And the engine matters: on
                one test sentence AWS Transcribe heard "async function" as "tracing function". Whisper large-v3 kept the
                English terms intact, which is why Vaani uses it.
              </p>
            </div>
            <SyncExplainer />
          </div>
        </section>

        <section id="hinglish" className="scroll-mt-16 border-t">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
            <SectionHeading title="Written the way you actually talk">
              Scripts come out in Hinglish, not stiff translated Hindi. English terms stay as they are, so you never
              stumble over a word you'd never say in Hindi.
            </SectionHeading>
            <div className="flex flex-col gap-6 rounded-2xl border bg-card p-6 sm:p-8">
              {HINGLISH_LINES.map((line) => (
                <HighlightedLine key={line} text={line} />
              ))}
              <p className="text-xs text-muted-foreground">
                Drafted from the vercel/ms repo. <span className="text-primary">Blue</span> is English.
              </p>
            </div>
          </div>
        </section>

        <section id="stack" className="scroll-mt-16 border-t bg-sidebar">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6">
            <SectionHeading title="What's under the hood">
              Small parts, each doing one job. Deployed on AWS.
            </SectionHeading>
            <dl className="grid divide-y rounded-2xl border bg-card md:grid-cols-2 md:divide-y-0">
              {STACK.map((row, i) => (
                <div
                  key={row.part}
                  className={
                    "flex flex-col gap-1 p-5 md:min-h-28 " +
                    (i >= 2 ? "md:border-t " : "") +
                    (i % 2 === 0 ? "md:border-r" : "")
                  }
                >
                  <dt className="text-sm text-muted-foreground">{row.part}</dt>
                  <dd className="text-lg font-medium">{row.tech}</dd>
                  <dd className="text-sm text-muted-foreground">{row.note}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="faq" className="scroll-mt-16 border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Questions</h2>
            <Accordion className="flex flex-col">
              {FAQ.map((item) => (
                <AccordionItem key={item.q} value={item.q} className="border-b">
                  <AccordionTrigger className="py-4 text-base hover:no-underline">{item.q}</AccordionTrigger>
                  <AccordionContent className="max-w-2xl text-base text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="border-t bg-sidebar">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6">
            <h2 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Your next code walkthrough is one read-through away.
            </h2>
            <Button render={<Link to="/app/studio" />} size="lg" className="h-11 px-5 text-base">
              Make a video
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <p>Built for the First Commit hackathon, WeMakeDevs x AWS.</p>
          <nav className="flex gap-4" aria-label="Footer">
            <Link to="/app" className="hover:text-foreground">
              Dashboard
            </Link>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
