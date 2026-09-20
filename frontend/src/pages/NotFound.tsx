import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { GridFrame } from "@/components/landing/frame";

export default function NotFound() {
  return (
    <GridFrame>
      <div className="mx-auto flex min-h-screen max-w-[1480px] flex-col items-center justify-center gap-6 border-x border-line-strong bg-background px-4 text-center font-mono">
        <Logo />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">This page doesn't exist</h1>
          <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
            The link may be wrong, or the page may have moved. Head back and pick up from there.
          </p>
        </div>
        <div className="flex gap-3">
          <Button render={<Link to="/" />} variant="outline" size="sm" className="h-9 border-line-strong text-xs">
            Back to the site
          </Button>
          <Button render={<Link to="/app" />} variant="ink" size="sm" className="h-9 text-xs">
            Open dashboard
          </Button>
        </div>
      </div>
    </GridFrame>
  );
}
