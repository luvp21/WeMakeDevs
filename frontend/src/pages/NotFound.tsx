import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">This page doesn't exist</h1>
        <p className="max-w-sm text-muted-foreground">
          The link may be wrong, or the page may have moved. Head back and pick up from there.
        </p>
      </div>
      <div className="flex gap-2">
        <Button render={<Link to="/" />} variant="outline">
          Back to the site
        </Button>
        <Button render={<Link to="/app" />}>Open dashboard</Button>
      </div>
    </div>
  );
}
