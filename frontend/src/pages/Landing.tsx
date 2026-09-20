import { useEffect, useState } from "react";
import { motion, useReducedMotion, useScroll } from "motion/react";
import { Link } from "react-router";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Menu, Video, Languages, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
import { GridFrame, Section, Crosshair } from "@/components/landing/frame";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { PipelineTabs } from "@/components/landing/PipelineTabs";
import { SyncExplainer } from "@/components/landing/SyncExplainer";
import { LanguagesSection } from "@/components/landing/LanguagesSection";
import { StackMarquee } from "@/components/landing/StackMarquee";
import { FaqSection } from "@/components/landing/FaqSection";
import { FooterWord, BackToTop } from "@/components/landing/FooterWord";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#sync", label: "Sync" },
  { href: "#languages", label: "Languages" },
  { href: "#stack", label: "Stack" },
  { href: "#faq", label: "FAQ" },
];

function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-primary origin-left pointer-events-none"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

function Nav() {
  const { session } = useAuth();
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const sectionIds = ["how", "sync", "languages", "stack", "faq"];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(`#${entry.target.id}`);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-line-strong bg-background/90 backdrop-blur font-mono">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between border-x border-line-strong px-4 sm:px-6">
        <Link to="/" aria-label="Vaani home" className="flex items-center gap-2">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {NAV_LINKS.map((link) => {
            const isActive = activeSection === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                className={`relative px-3 py-1.5 text-xs transition-colors hover:text-foreground ${
                  isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary" />
                )}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {session ? (
            <>
              <Button render={<Link to="/app" />} variant="ghost" size="sm" className="hidden text-xs sm:inline-flex">
                Dashboard
              </Button>
              <Button render={<Link to="/app/studio" />} variant="ink" size="sm" className="text-xs">
                Make a video
              </Button>
            </>
          ) : (
            <>
              <Button render={<Link to="/sign-in" />} variant="ghost" size="sm" className="hidden text-xs sm:inline-flex">
                Sign in
              </Button>
              <Button render={<Link to="/sign-in" />} variant="ink" size="sm" className="text-xs">
                Try Vaani
              </Button>
            </>
          )}

          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu" />}>
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="right" className="font-mono">
              <SheetHeader>
                <SheetTitle className="font-mono text-left">Vaani</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-2 pt-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose key={link.href} render={<a href={link.href} className="rounded-md px-3 py-2 text-sm hover:bg-accent" />}>
                    {link.label}
                  </SheetClose>
                ))}
                <SheetClose
                  render={<Link to={session ? "/app" : "/sign-in"} className="rounded-md px-3 py-2 text-sm hover:bg-accent" />}
                >
                  {session ? "Dashboard" : "Sign in"}
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
    <section className="relative w-full border-b border-line-strong">
      <div className="relative mx-auto max-w-[1200px] border-x border-line-strong bg-background">
        <Crosshair className="-top-1.25 -left-1.25" />
        <Crosshair className="-top-1.25 -right-1.25" />

        {/* Hero two-column grid */}
        <div className="grid items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-12 lg:py-16">
          <div className="flex flex-col gap-6 font-mono">
            {/* Pill tag */}
            <div className="inline-flex w-max items-center gap-2 rounded-full border border-line-strong bg-secondary px-3 py-1 text-xs text-muted-foreground select-none">
              <span className="size-1.5 rounded-full bg-primary" />
              Built for First Commit &middot; WeMakeDevs &times; AWS
            </div>

            {/* Headline */}
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
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

            {/* Subcopy */}
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Paste a GitHub repo, read the Hinglish script Vaani drafts, and it cuts the code, slides and diagrams in on
              the exact words you say.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button render={<Link to="/app/studio" />} variant="ink" size="lg" className="h-10 px-5 text-sm">
                Make a video
                <ArrowRight data-icon="inline-end" className="size-4" />
              </Button>
              <Button render={<a href="#sync" />} variant="ghost" size="lg" className="h-10 px-4 text-sm border border-line-strong hover:bg-accent">
                See how it syncs
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">Works with any public repo. Nothing to install.</p>
          </div>

          <HeroDemo />
        </div>

        {/* Stat strip (3 bordered cells across column) */}
        <div className="grid grid-cols-1 border-t border-line-strong font-mono sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line-strong">
          <div className="flex items-center gap-3 p-4">
            <Video className="size-4 text-primary shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">5 video formats</span>
              <span className="text-[11px] text-muted-foreground">Code, Hackathon, Demo, Architecture, Teaser</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Languages className="size-4 text-primary shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">English + Hinglish</span>
              <span className="text-[11px] text-muted-foreground">Drafted in Latin script, English terms intact</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <UserCheck className="size-4 text-primary shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">Your real voice and face</span>
              <span className="text-[11px] text-muted-foreground">Teleprompter recording, cut on your words</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex max-w-2xl flex-col gap-2 font-mono pb-2">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

export default function Landing() {
  return (
    <GridFrame>
      <ScrollProgressBar />
      <Nav />
      <main>
        <Hero />

        {/* 02 / How it works */}
        <Section id="how" label="02 / How it works">
          <div className="flex flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
            <SectionHeading title="From repo to finished video in five steps">
              You supply the one thing software can't fake: your voice, reading it your way.
            </SectionHeading>
            <PipelineTabs />
          </div>
        </Section>

        {/* 03 / Sync */}
        <Section id="sync" label="03 / Sync">
          <div className="grid gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-14">
            <div className="flex flex-col gap-4 font-mono">
              <div className="inline-flex w-max items-center gap-1.5 rounded border border-line-strong bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                Two pointers &middot; plain TypeScript &middot; no ML alignment model
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                The cut lands on the word you said
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Speech-to-text is messy. Your script isn't. Vaani walks both side by side and only moves the script
                forward when a word matches, so a stutter or a filler can't drag a cut off target.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Hindi words come back spelled phonetically, so matching is fuzzy on purpose. And the engine matters: on
                one test sentence AWS Transcribe heard "async function" as "tracing function". Whisper large-v3 kept the
                English terms intact, which is why Vaani uses it.
              </p>
            </div>
            <SyncExplainer />
          </div>
        </Section>

        {/* 04 / Languages */}
        <Section id="languages" label="04 / Languages">
          <div className="flex flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
            <SectionHeading title="Written the way you actually talk">
              Scripts come out in Hinglish, not stiff translated Hindi. English terms stay as they are, so you never
              stumble over a word you'd never say in Hindi.
            </SectionHeading>
            <LanguagesSection />
          </div>
        </Section>

        {/* 05 / Stack */}
        <Section id="stack" label="05 / Stack">
          <div className="flex flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
            <SectionHeading title="What's under the hood">
              Small parts, each doing one job. Deployed on AWS.
            </SectionHeading>
            <StackMarquee />
          </div>
        </Section>

        {/* 06 / Questions */}
        <Section id="faq" label="06 / Questions">
          <div className="px-4 py-12 sm:px-6 sm:py-16">
            <FaqSection />
          </div>
        </Section>

        {/* 07 / CTA Section */}
        <Section label="07 / CTA">
          <div className="flex flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-20 font-mono">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Your next code walkthrough is one read-through away.
            </h2>
            <Button render={<Link to="/app/studio" />} variant="ink" size="lg" className="h-11 px-6 text-base">
              Make a video
              <ArrowRight data-icon="inline-end" className="size-4" />
            </Button>
            <p className="text-xs text-muted-foreground">Works with any public repo. Nothing to install.</p>
          </div>
        </Section>
      </main>

      {/* Footer bar */}
      <footer className="w-full border-t border-line-strong bg-background font-mono">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-4 border-x border-line-strong px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <p className="text-center">Built for the First Commit hackathon, WeMakeDevs &times; AWS.</p>
          <nav className="flex gap-4" aria-label="Footer">
            <Link to="/app" className="hover:text-foreground">
              Dashboard
            </Link>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
            {import.meta.env.VITE_GITHUB_URL && (
              <a href={import.meta.env.VITE_GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
                GitHub ↗
              </a>
            )}
          </nav>
        </div>

        <div className="mx-auto flex max-w-[1200px] border-x border-t border-line-strong px-4 py-3 text-[11px] text-muted-foreground sm:px-6">
          &copy; 2026 Vaani &middot; Team cosmosapiens
        </div>

        {/* Bitmap Footer Word animation */}
        <div className="mx-auto max-w-[1200px] border-x border-line-strong">
          <FooterWord />
        </div>
      </footer>

      <BackToTop />
    </GridFrame>
  );
}
