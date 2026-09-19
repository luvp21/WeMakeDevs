import { useEffect, useState } from "react";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import type { Script, SyncResult, TranscribeStatus } from "@vaani/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import * as api from "@/lib/api";

interface SyncPanelProps {
  script: Script;
  lockedScriptId: string;
  recorded: boolean;
  synced: boolean;
  onSynced: (result: SyncResult) => void;
  onContinue: () => void;
}

const POLL_MS = 3000;

function SceneStatusBadge({ status }: { status: TranscribeStatus | undefined }) {
  if (!status || status.status === "in_progress") {
    return (
      <Badge variant="secondary">
        <Spinner data-icon="inline-start" className="size-3" />
        Transcribing
      </Badge>
    );
  }
  if (status.status === "failed") {
    return (
      <Badge variant="destructive">
        <CircleAlert data-icon="inline-start" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-success">
      <Check data-icon="inline-start" />
      <span className="tabular">{status.words?.length ?? 0} words</span>
    </Badge>
  );
}

export function SyncPanel({ script, lockedScriptId, recorded, synced, onSynced, onContinue }: SyncPanelProps) {
  const [statuses, setStatuses] = useState<Record<string, TranscribeStatus>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const allReady =
    recorded && script.scenes.every((scene) => statuses[scene.id]?.status === "completed");

  useEffect(() => {
    if (!recorded || allReady) return;
    let cancelled = false;

    async function poll() {
      const entries = await Promise.all(
        script.scenes.map(async (scene) => {
          try {
            return [scene.id, await api.getTranscriptionStatus(lockedScriptId, scene.id)] as const;
          } catch (err) {
            const failed: TranscribeStatus = {
              script_id: lockedScriptId,
              scene_id: scene.id,
              status: "failed",
              error: err instanceof Error ? err.message : "Unexpected error",
            };
            return [scene.id, failed] as const;
          }
        }),
      );
      if (!cancelled) setStatuses(Object.fromEntries(entries));
    }

    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [recorded, allReady, script.scenes, lockedScriptId]);

  async function runSync() {
    setSyncError(null);
    setSyncing(true);
    try {
      const result = await api.syncRecordings(lockedScriptId);
      onSynced(result);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSyncing(false);
    }
  }

  if (!recorded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nothing to sync yet</CardTitle>
          <CardDescription>
            Record every scene first. Syncing matches your voice to the script, so it needs your recordings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your recordings</CardTitle>
        <CardDescription>
          Each scene is transcribed, then matched word by word to the script to find when every beat begins.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ul className="flex flex-col divide-y rounded-lg border">
          {script.scenes.map((scene, index) => (
            <li key={scene.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground tabular">
                  {index + 1}
                </span>
                <span className="truncate text-sm">{scene.title}</span>
              </span>
              <SceneStatusBadge status={statuses[scene.id]} />
            </li>
          ))}
        </ul>

        {syncError && (
          <Alert variant="destructive">
            <AlertTitle>Couldn't sync</AlertTitle>
            <AlertDescription>{syncError}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          {synced ? (
            <Button onClick={onContinue}>
              Continue to video
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button onClick={runSync} disabled={!allReady || syncing}>
              {syncing && <Spinner data-icon="inline-start" />}
              {syncing ? "Syncing" : allReady ? "Sync my voice to the script" : "Waiting for transcripts"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
