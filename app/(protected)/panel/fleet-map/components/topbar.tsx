import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FLEET_POLL_MS, LIVE_POLL_MS } from "../constants";
import { formatAgo } from "../lib/format";
import type { FleetCounts, RealtimeStatus, WorkspaceMode } from "../types";

type TopbarProps = {
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  simulationOn: boolean;
  feedError: boolean;
  gpsError: boolean;
  realtimeStatus: RealtimeStatus;
  feedUpdatedAt: number;
  gpsUpdatedAt: number;
  now: number;
  counts: FleetCounts;
  onJumpToAttention: () => void;
  onRetry: () => void;
  onReconnect: () => void;
  tools?: ReactNode;
};

export function Topbar({
  mode,
  onModeChange,
  fullscreen,
  onToggleFullscreen,
  simulationOn,
  feedError,
  gpsError,
  realtimeStatus,
  feedUpdatedAt,
  gpsUpdatedAt,
  now,
  counts,
  onJumpToAttention,
  onRetry,
  onReconnect,
  tools,
}: TopbarProps) {
  const feedAge = feedUpdatedAt > 0 ? Math.max(0, now - feedUpdatedAt) : null;
  const gpsAge = gpsUpdatedAt > 0 ? Math.max(0, now - gpsUpdatedAt) : null;
  const feedStale = feedAge !== null && feedAge > FLEET_POLL_MS * 2;
  const gpsStale = gpsAge !== null && gpsAge > LIVE_POLL_MS * 2;
  const hasSyncIssue =
    !simulationOn &&
    (realtimeStatus !== "connected" ||
      feedError ||
      gpsError ||
      feedStale ||
      gpsStale);

  const activeCount = counts.delivering + counts.returning;

  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b bg-background px-3 sm:px-3.5">
      {/* Left: Title + single compact live health popover */}
      <div className="flex min-w-0 items-center gap-2.5">
        <h1 className="truncate text-sm font-semibold tracking-tight">
          Fleet map
        </h1>

        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label="Connection and sync status"
                className={cn(
                  "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  simulationOn
                    ? "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
                    : hasSyncIssue
                      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                      : "border-transparent bg-muted/60 text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    simulationOn
                      ? "bg-violet-500"
                      : hasSyncIssue
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                  aria-hidden="true"
                />
                <span>
                  {simulationOn
                    ? "Sim"
                    : realtimeStatus === "disconnected"
                      ? "Offline"
                      : realtimeStatus === "reconnecting" ||
                          realtimeStatus === "connecting"
                        ? "Connecting"
                        : feedError || gpsError
                          ? "Sync error"
                          : feedStale || gpsStale
                            ? "Delayed"
                            : "Live"}
                </span>
              </button>
            }
          />

          <PopoverContent align="start" className="w-60 space-y-2.5 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Feed status</span>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <RefreshCw className="size-3" aria-hidden="true" />
                Refresh
              </button>
            </div>

            <dl className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Realtime</dt>
                <dd className="font-medium capitalize text-foreground">
                  {simulationOn ? "Paused (sim)" : realtimeStatus}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Fleet data</dt>
                <dd className="tabular-nums text-foreground">
                  {feedError
                    ? "Failed"
                    : feedAge === null
                      ? "Syncing…"
                      : formatAgo(feedAge)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">GPS feed</dt>
                <dd className="tabular-nums text-foreground">
                  {simulationOn
                    ? "Simulated"
                    : gpsError
                      ? "Failed"
                      : gpsAge === null
                        ? "Syncing…"
                        : formatAgo(gpsAge)}
                </dd>
              </div>
            </dl>

            {!simulationOn && realtimeStatus !== "connected" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 w-full text-xs"
                onClick={onReconnect}
              >
                Reconnect channel
              </Button>
            ) : null}
          </PopoverContent>
        </Popover>

        {/* Quiet inline operational summary on md+ */}
        <div className="hidden items-center gap-2 border-l pl-2.5 text-xs text-muted-foreground md:flex">
          <span className="tabular-nums">
            <strong className="font-semibold text-foreground">
              {activeCount}
            </strong>{" "}
            active
          </span>
          <span aria-hidden="true" className="text-border">
            /
          </span>
          <span className="tabular-nums">
            <strong className="font-semibold text-foreground">
              {counts.available}
            </strong>{" "}
            ready
          </span>
          {counts.gpsAttention > 0 ? (
            <>
              <span aria-hidden="true" className="text-border">
                /
              </span>
              <button
                type="button"
                onClick={onJumpToAttention}
                className="tabular-nums font-medium text-orange-700 hover:underline dark:text-orange-400"
              >
                {counts.gpsAttention} GPS
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Right: Clean 2-mode switch + Fullscreen + Dev tools */}
      <div className="flex items-center gap-1.5">
        <div
          role="group"
          aria-label="Workspace view"
          className="inline-flex h-7 items-center rounded-md border bg-muted/50 p-0.5"
        >
          {(
            [
              { value: "map", label: "Map" },
              { value: "table", label: "Table" },
            ] as const
          ).map(({ value, label }) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => onModeChange(value)}
                className={cn(
                  "h-full rounded-[4px] px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onToggleFullscreen}
          aria-pressed={fullscreen}
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          className="size-7"
        >
          {fullscreen ? (
            <Minimize2 className="size-3.5" aria-hidden="true" />
          ) : (
            <Maximize2 className="size-3.5" aria-hidden="true" />
          )}
        </Button>

        {tools}
      </div>
    </header>
  );
}
