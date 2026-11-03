import {
  AlertTriangle,
  Columns2,
  List,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatAgo } from "../lib/format";
import { FLEET_POLL_MS, LIVE_POLL_MS } from "../constants";

export type FleetCounts = {
  delivering: number;
  returning: number;
  available: number;
};

export type FleetView = "split" | "map" | "list";

export type RealtimeStatus =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected";

type TopbarProps = {
  simulationOn: boolean;
  feedError: boolean;
  gpsError: boolean;
  realtimeStatus: RealtimeStatus;
  /** Epoch ms of the last successful fleet API poll (0 = none yet). */
  feedUpdatedAt: number;
  /** Epoch ms of the last successful GPS API poll (0 = none yet). */
  gpsUpdatedAt: number;
  now: number;
  counts: FleetCounts;
  onOpenList: () => void;
  view: FleetView;
  onViewChange: (view: FleetView) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  onRetry: () => void;
  onReconnect: () => void;
  /** The testing-tools control, rendered on the right. */
  tools: ReactNode;
};

const PILL =
  "inline-flex items-center gap-1.5 rounded-full border bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur";

export function Topbar({
  simulationOn,
  feedError,
  gpsError,
  realtimeStatus,
  feedUpdatedAt,
  gpsUpdatedAt,
  now,
  counts,
  onOpenList,
  view,
  onViewChange,
  expanded,
  onToggleExpanded,
  onRetry,
  onReconnect,
  tools,
}: TopbarProps) {
  return (
    <header className="shrink-0 space-y-3 border-b bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-base font-semibold">Fleet tracking</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">Track vehicles, review trips, and manage return pickups.</p>
        </div>
        <div role="group" aria-label="Fleet view" className="flex items-center gap-1 rounded-lg border p-1">
          {([
            { value: "split", label: "Map & list", icon: Columns2 },
            { value: "map", label: "Map only", icon: MapIcon },
            { value: "list", label: "List only", icon: List },
          ] as const).map(({ value, label, icon: Icon }) => (
            <Button key={value} type="button" size="sm" variant={view === value ? "secondary" : "ghost"} className="h-8 gap-1.5 px-2 text-xs" aria-pressed={view === value} onClick={() => onViewChange(value)}>
              <Icon className="size-3.5" aria-hidden="true" />{label}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onToggleExpanded} aria-pressed={expanded} aria-label={expanded ? "Exit expanded workspace" : "Expand workspace"} title={expanded ? "Exit expanded workspace (Esc)" : "Expand workspace"}>
          {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          <span className="hidden sm:inline">{expanded ? "Exit expanded" : "Expand"}</span>
        </Button>
        {tools}
      </div>
      <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onOpenList}
        className={cn("gap-1.5 lg:hidden", view !== "split" && "hidden")}
      >
        <List className="size-4" />
        Browse fleet
      </Button>

      <div className="pointer-events-auto">
        <FeedStatus
          simulationOn={simulationOn}
          feedError={feedError}
          gpsError={gpsError}
          realtimeStatus={realtimeStatus}
          feedUpdatedAt={feedUpdatedAt}
          gpsUpdatedAt={gpsUpdatedAt}
          now={now}
          onRetry={onRetry}
          onReconnect={onReconnect}
        />
      </div>

      <div className="ml-auto hidden flex-wrap items-center gap-2 xl:flex">
        <span className={PILL}>
          <span className="size-2 rounded-full bg-blue-500" />
          {counts.delivering} on route
        </span>
        <span className={PILL}>
          <span className="size-2 rounded-full bg-violet-500" />
          {counts.returning} returning
        </span>
        <span className={PILL}>
          <span className="size-2 rounded-full bg-emerald-500" />
          {counts.available} available fleet-wide
        </span>
      </div>

      </div>
    </header>
  );
}

function FeedStatus({
  simulationOn,
  feedError,
  gpsError,
  realtimeStatus,
  feedUpdatedAt,
  gpsUpdatedAt,
  now,
  onRetry,
  onReconnect,
}: Pick<
  TopbarProps,
  | "simulationOn"
  | "feedError"
  | "gpsError"
  | "realtimeStatus"
  | "feedUpdatedAt"
  | "gpsUpdatedAt"
  | "now"
  | "onRetry"
  | "onReconnect"
>) {
  if (simulationOn) {
    return (
      <span
        className={cn(
          PILL,
          "border-violet-500/40 text-violet-700 dark:text-violet-300",
        )}
      >
        Simulation mode
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          PILL,
          realtimeStatus === "connected"
            ? "text-emerald-700 dark:text-emerald-400"
            : realtimeStatus === "connecting"
              ? "text-blue-700 dark:text-blue-400"
              : "border-amber-500/40 text-amber-700 dark:text-amber-400",
        )}
      >
        {realtimeStatus === "connected" ? (
          <Radio className="size-3.5" />
        ) : realtimeStatus === "disconnected" ? (
          <WifiOff className="size-3.5" />
        ) : (
          <Wifi className="size-3.5" />
        )}
        {realtimeStatus === "connected"
          ? "Live updates connected"
          : realtimeStatus === "connecting"
            ? "Connecting live updates…"
            : realtimeStatus === "reconnecting"
              ? "Reconnecting live updates…"
              : "Live updates offline"}
      </span>
      {realtimeStatus !== "connected" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 bg-background/95 px-2 text-xs"
          onClick={onReconnect}
        >
          <RefreshCw className="size-3" />
          Reconnect
        </Button>
      ) : null}
      <FreshnessStatus
        label="Fleet"
        error={feedError}
        updatedAt={feedUpdatedAt}
        now={now}
        staleAfterMs={FLEET_POLL_MS * 2}
        onRetry={onRetry}
      />
      <FreshnessStatus
        label="GPS"
        error={gpsError}
        updatedAt={gpsUpdatedAt}
        now={now}
        staleAfterMs={LIVE_POLL_MS * 2}
        onRetry={onRetry}
      />
    </div>
  );
}

function FreshnessStatus({
  label,
  error,
  updatedAt,
  now,
  staleAfterMs,
  onRetry,
}: {
  label: string;
  error: boolean;
  updatedAt: number;
  now: number;
  staleAfterMs: number;
  onRetry: () => void;
}) {
  const ageMs = updatedAt > 0 ? Math.max(0, now - updatedAt) : null;
  const stale = ageMs === null || ageMs > staleAfterMs;

  return (
    <span
      className={cn(
        PILL,
        error || stale
          ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
          : "text-muted-foreground",
      )}
    >
      {error || stale ? (
        <AlertTriangle className="size-3.5" />
      ) : (
        <Radio className="size-3.5" />
      )}
      {error
        ? `${label} sync failed${ageMs === null ? "" : ` · ${formatAgo(ageMs)}`}`
        : ageMs === null
          ? `${label} not synced`
          : stale
            ? `${label} stale · ${formatAgo(ageMs)}`
            : `${label} checked ${formatAgo(ageMs)}`}
      {error || stale ? (
        <button
          type="button"
          className="ml-0.5 rounded-sm p-0.5 hover:bg-muted"
          onClick={onRetry}
          aria-label={`Retry ${label.toLowerCase()} sync`}
        >
          <RefreshCw className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
