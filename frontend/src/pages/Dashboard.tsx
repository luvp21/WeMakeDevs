import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { ArrowRight, Clapperboard, MoreHorizontal, Plus } from "lucide-react";
import type { ProjectStage, ProjectSummary } from "@vaani/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { STAGE_ACTION, STAGE_LABEL, STAGE_STEPS_DONE, relativeTime } from "@/lib/stage";
import * as api from "@/lib/api";

type Filter = "all" | "progress" | "done";
const POLL_MS = 5000;
const TOTAL_STEPS = 5;

function matches(filter: Filter, stage: ProjectStage): boolean {
  if (filter === "all") return true;
  if (filter === "done") return stage === "done";
  return stage !== "done";
}

function StageBadge({ stage }: { stage: ProjectStage }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        stage === "done" && "text-success",
        stage === "error" && "text-destructive",
        stage === "rendering" && "text-primary",
      )}
    >
      {STAGE_LABEL[stage]}
    </Badge>
  );
}

function StepDots({ done }: { done: number }) {
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`${done} of ${TOTAL_STEPS} steps complete`}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <span key={i} className={cn("h-1.5 w-5 rounded-full", i < done ? "bg-primary" : "bg-muted")} />
      ))}
    </span>
  );
}

function EmptyState() {
  return (
    <Card className="items-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Clapperboard className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">No videos yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Paste a GitHub repo and Vaani drafts the script. You read it aloud, and the visuals cut in on your words.
        </p>
      </div>
      <Button render={<Link to="/app/studio" />}>
        <Plus data-icon="inline-start" />
        Make your first video
      </Button>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const isJudge = session?.role === "judge";
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      const { projects: list } = await api.listProjects();
      setProjects(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load projects");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const anyRendering = projects?.some((p) => p.stage === "rendering") ?? false;
  useEffect(() => {
    if (!anyRendering) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [anyRendering, load]);

  const visible = useMemo(() => (projects ?? []).filter((p) => matches(filter, p.stage)), [projects, filter]);
  const inProgress = (projects ?? []).filter((p) => p.stage !== "done").length;

  function copyLink(id: string) {
    void navigator.clipboard.writeText(`${window.location.origin}/app/studio/${id}`);
    toast.success("Link copied");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Projects</h1>
        <p className="text-muted-foreground">
          Every locked script is a project. Pick one up where you left it.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load your projects</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {projects === null && !error && (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {projects !== null && projects.length === 0 && <EmptyState />}

      {projects !== null && projects.length > 0 && (
        <div className="flex flex-col gap-4">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All ({projects.length})</TabsTrigger>
              <TabsTrigger value="progress">In progress ({inProgress})</TabsTrigger>
              <TabsTrigger value="done">Finished ({projects.length - inProgress})</TabsTrigger>
            </TabsList>
          </Tabs>

          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Project</TableHead>
                  {isJudge && <TableHead>Made by</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Progress</TableHead>
                  <TableHead className="hidden sm:table-cell">Recorded</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="w-0 pr-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((project) => (
                  <TableRow
                    key={project.script_id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/app/studio/${project.script_id}`)}
                  >
                    <TableCell className="pl-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-medium">{project.title}</span>
                        <span className="text-xs text-muted-foreground tabular">
                          {project.scene_count} {project.scene_count === 1 ? "scene" : "scenes"}, {project.beat_count}{" "}
                          {project.beat_count === 1 ? "beat" : "beats"}
                        </span>
                      </div>
                    </TableCell>
                    {isJudge && (
                      <TableCell className="text-muted-foreground">{project.owner_name ?? project.owner ?? "Before accounts"}</TableCell>
                    )}
                    <TableCell>
                      <StageBadge stage={project.stage} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <StepDots done={STAGE_STEPS_DONE[project.stage]} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground tabular sm:table-cell">
                      {project.recorded_scene_ids.length}/{project.scene_count}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground tabular lg:table-cell">
                      {relativeTime(project.locked_at)}
                    </TableCell>
                    <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="hidden sm:inline-flex"
                          render={<Link to={`/app/studio/${project.script_id}`} />}
                        >
                          {STAGE_ACTION[project.stage]}
                          <ArrowRight data-icon="inline-end" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" aria-label={`Actions for ${project.title}`} />
                            }
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/app/studio/${project.script_id}`)}>
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLink(project.script_id)}>
                              Copy link
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Nothing here yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
