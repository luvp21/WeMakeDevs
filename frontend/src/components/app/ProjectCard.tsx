import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, MoreHorizontal, Play } from "lucide-react";
import type { ProjectStage, ProjectSummary } from "@vaani/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProjectStepper } from "@/components/app/ProjectStepper";
import { cn } from "@/lib/utils";
import { STAGE_ACTION, STAGE_LABEL, STAGE_STEPS_DONE, nextStepText, relativeTime, repoParts } from "@/lib/stage";
import { CornerMarks } from "@/components/ui/corner-marks";

export function StageBadge({ stage }: { stage: ProjectStage }) {
  return (
    <Badge
      variant="secondary"
      className={cn(stage === "done" && "text-success", stage === "error" && "text-destructive", stage === "rendering" && "text-primary")}
    >
      {STAGE_LABEL[stage]}
    </Badge>
  );
}

// The repo owner's GitHub avatar, or a letter tile if it can't load.
function RepoAvatar({ owner, name }: { owner: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !owner) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line-strong bg-secondary font-mono text-sm font-semibold uppercase">
        {(name || "?").slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={`https://github.com/${encodeURIComponent(owner)}.png?size=80`}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-10 shrink-0 rounded-md border border-line-strong bg-secondary"
    />
  );
}

interface ProjectCardProps {
  project: ProjectSummary;
  showOwner: boolean;
  onCopyLink: (id: string) => void;
  onWatch: (project: ProjectSummary) => void;
}

export function ProjectCard({ project, showOwner, onCopyLink, onWatch }: ProjectCardProps) {
  const { owner, name } = repoParts(project.title);
  const studioPath = `/app/studio/${project.script_id}`;
  const isDone = project.stage === "done";
  return (
    <Card className="group/box relative gap-4 border border-line-strong p-4 shadow-xs transition-colors hover:border-primary/50">
      <CornerMarks hover inside />
      <div className="flex items-start gap-3">
        <RepoAvatar owner={owner} name={name} />
        <div className="flex min-w-0 flex-1 flex-col">
          {owner && <span className="truncate font-mono text-xs text-muted-foreground">{owner}/</span>}
          <Link to={studioPath} className="truncate font-mono text-base font-semibold hover:underline">
            {name}
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${project.title}`} />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link to={studioPath} />}>Open</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCopyLink(project.script_id)}>Copy link</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-2">
        <ProjectStepper done={STAGE_STEPS_DONE[project.stage]} failed={project.stage === "error"} />
        <div className="flex items-center justify-between gap-2">
          <StageBadge stage={project.stage} />
          <span className="truncate font-mono text-xs text-muted-foreground">{nextStepText(project)}</span>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line-strong pt-3">
        <div className="flex min-w-0 flex-col font-mono text-xs text-muted-foreground tabular">
          <span>
            {project.scene_count} {project.scene_count === 1 ? "scene" : "scenes"}, {project.beat_count}{" "}
            {project.beat_count === 1 ? "beat" : "beats"}
          </span>
          <span className="truncate">
            {relativeTime(project.locked_at)}
            {showOwner && ` by ${project.owner_name ?? project.owner ?? "before accounts"}`}
          </span>
        </div>
        {isDone ? (
          <Button size="sm" onClick={() => onWatch(project)}>
            <Play data-icon="inline-start" />
            Watch
          </Button>
        ) : (
          <Button variant="outline" size="sm" render={<Link to={studioPath} />}>
            {STAGE_ACTION[project.stage]}
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </Card>
  );
}
