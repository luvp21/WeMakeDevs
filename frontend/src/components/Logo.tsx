import { AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, showWord = true }: { className?: string; showWord?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <AudioLines className="size-4" />
      </span>
      {showWord && <span className="text-base font-semibold tracking-tight">Vaani</span>}
    </span>
  );
}
