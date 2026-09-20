import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Download, X } from "lucide-react";
import type { ProjectSummary } from "@vaani/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import * as api from "@/lib/api";

interface WatchDialogProps {
  project: ProjectSummary | null;
  onClose: () => void;
}

// Loads and plays one video. Mounted fresh for each project (keyed by id), so
// its state always starts empty.
function WatchBody({ scriptId }: { scriptId: string }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getProject(scriptId)
      .then((detail) => {
        if (cancelled) return;
        if (detail.render?.video_url) setVideoUrl(detail.render.video_url);
        else setError("This video isn't available to play.");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load the video");
      });
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't play the video</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!videoUrl) return <Skeleton className="aspect-video w-full rounded-lg" />;
  return (
    <>
      <video controls autoPlay src={videoUrl} className="aspect-video w-full rounded-lg border bg-black" />
      <div className="flex justify-end">
        <a href={videoUrl} download="vaani-video.mp4" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <Download data-icon="inline-start" />
          Download MP4
        </a>
      </div>
    </>
  );
}

// Plays a finished video without opening the whole Studio. The summary carries
// no video address, so it is fetched once when the dialog opens.
export function WatchDialog({ project, onClose }: WatchDialogProps) {
  return (
    <Dialog.Root open={project !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(92vw,56rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border border-line-strong bg-card p-4 shadow-lg outline-none">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="truncate font-mono text-sm font-semibold">{project?.title}</Dialog.Title>
            <Dialog.Close render={<Button variant="ghost" size="icon-sm" aria-label="Close" />}>
              <X />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Playback of the finished video</Dialog.Description>
          {project && <WatchBody key={project.script_id} scriptId={project.script_id} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
