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
import { FLEET_POLL_MS, LIVE_POLL_MS } from "../constants";
import { formatAgo } from "../lib/format";
import type {
  FleetCounts,
  FleetView,
  RealtimeStatus,
  VehicleFilter,
} from "../types";

type TopbarProps = {
  simulationOn: boolean;
  feedError: boolean;
  gpsError: boolean;
  realtimeStatus: RealtimeStatus;
  feedUpdatedAt: number;
  gpsUpdatedAt: number;
  now: number;
  counts: FleetCounts;
  activeFilter: VehicleFilter;
  onFilterSelect: (filter: VehicleFilter) => void;
  onOpenList: () => void;
  view: FleetView;
  onViewChange: (view: FleetView) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onRetry: () => void;
  onReconnect: () => void;
  tools?: ReactNode;
};

export function Topbar({
  simulationOn,
  feedError,
  gpsError,
  realtimeStatus,
  feedUpdatedAt,
  gpsUpdatedAt,
  now,
  counts,
  activeFilter,
  onFilterSelect,
  onOpenList,
  view,
  onViewChange,
  fullscreen,
  onToggleFullscreen,
  onRetry,
  onReconnect,
  tools,
}: TopbarProps) {
  const summaryItems: {
    key: VehicleFilter;
    label: string;
    count: number;
    dot: string;
    activeClass: string;
  }[] = [
    {
      key: "all",
      label: "All",
      count: counts.total,
      dot: "bg-slate-500",
      activeClass: "border-primary bg-primary/10 text-primary",
    },
    {
      key: "delivering",
      label: "On route",
      count: counts.delivering,
      dot: "bg-blue-600",
      activeClass: "border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
    },
    {
      key: "returning",
      label: "Returning",
      count: counts.returning,
      dot: "bg-indigo-500",
      activeClass: "border-indigo-600 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200",
    },
    {
      key: "available",
      label: "Available",
      count: counts.available,
      dot: "bg-emerald-600",
      activeClass: "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
    },
    {
      key: "blocked",
      label: "Out of service",
      count: counts.blocked,
      dot: "bg-amber-600",
      activeClass: "border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
    },
    {
      key: "gps_attention",
      label: "GPS attention",
      count: counts.gpsAttention,
      dot: "bg-orange-600",
      activeClass: "border-orange-600 bg-orange-50 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200",
    },
  ];

  return (
    <header className="shrink-0 border-b bg-background">
      {/* Row 1: Identity, Sync Health, View Mode Switcher & Fullscreen */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
              Fleet dispatch
            </h1>
          </div>

          <div className="hidden items-center gap-1.5 md:flex">
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
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div
            role="group"
            aria-label="Workspace view mode"
            className="inline-flex items-center rounded-md border bg-muted/40 p-0.5"
          >
            {(
              [
                { value: "split", label: "Map & List", shortLabel: "Split", icon: Columns2 },
                { value: "map", label: "Map Only", shortLabel: "Map", icon: MapIcon },
                { value: "list", label: "List Only", shortLabel: "List", icon: List },
              ] as const
            ).map(({ value, label, shortLabel, icon: Icon }) => {
              const active = view === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onViewChange(value)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{shortLabel}</span>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            size="sm"
            variant={fullscreen ? "default" : "outline"}
            onClick={onToggleFullscreen}
            aria-pressed={fullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            className="h-8 gap-1.5 px-2.5 text-xs"
          >
            {fullscreen ? (
              <Minimize2 className="size-3.5" aria-hidden="true" />
            ) : (
              <Maximize2 className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {fullscreen ? "Exit fullscreen" : "Fullscreen"}
            </span>
          </Button>

          {tools}
        </div>
      </div>

      {/* Row 2: Operational Fleet Summary + Mobile Sync & Browse */}
      <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/20 px-3 py-1.5 sm:px-4">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenList}
          className={cn(
            "h-7 gap-1.5 px-2.5 text-xs lg:hidden",
            view !== "split" && "hidden",
          )}
        >
          <List className="size-3.5" aria-hidden="true" />
          Browse fleet ({counts.total})
        </Button>

        <nav
          aria-label="Fleet status summary"
          className="flex flex-wrap items-center gap-1.5"
        >
          {summaryItems.map((item) => {
            const selected = activeFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={selected}
                aria-label={`${item.label}: ${item.count}`}
                onClick={() => onFilterSelect(item.key)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? item.activeClass
                    : "border-transparent bg-background/80 text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <span
                  className={cn("size-1.5 rounded-full", item.dot)}
                  aria-hidden="true"
                />
                <span>{item.label}</span>{" "}
                <span className="tabular-nums font-semibold text-foreground/90">
                  {item.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:hidden">
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
            compact
          />
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
  compact = false,
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
> & { compact?: boolean }) {
  if (simulationOn) {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-violet-300 bg-violet-50 px-2 text-[11px] font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
        Simulation active
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        title="Realtime WebSocket event channel (separate from vehicle GPS)"
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium",
          realtimeStatus === "connected"
            ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            : realtimeStatus === "connecting"
              ? "border-blue-200 bg-blue-50/80 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
        )}
      >
        {realtimeStatus === "connected" ? (
          <Radio className="size-3" aria-hidden="true" />
        ) : realtimeStatus === "disconnected" ? (
          <WifiOff className="size-3" aria-hidden="true" />
        ) : (
          <Wifi className="size-3" aria-hidden="true" />
        )}
        {realtimeStatus === "connected"
          ? compact
            ? "Channel OK"
            : "Channel connected"
          : realtimeStatus === "connecting"
            ? "Connecting…"
            : realtimeStatus === "reconnecting"
              ? "Reconnecting…"
              : "Channel offline"}
      </span>

      {realtimeStatus !== "connected" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={onReconnect}
        >
          <RefreshCw className="size-3" aria-hidden="true" />
          Reconnect
        </Button>
      ) : null}

      {!compact ? (
        <>
          <SyncFreshnessPill
            label="Fleet"
            error={feedError}
            updatedAt={feedUpdatedAt}
            now={now}
            staleAfterMs={FLEET_POLL_MS * 2}
            onRetry={onRetry}
          />
          <SyncFreshnessPill
            label="GPS"
            error={gpsError}
            updatedAt={gpsUpdatedAt}
            now={now}
            staleAfterMs={LIVE_POLL_MS * 2}
            onRetry={onRetry}
          />
        </>
      ) : null}
    </div>
  );
}

function SyncFreshnessPill({
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
        "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium",
        error || stale
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      {error || stale ? (
        <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
      ) : null}
      <span>
        {error
          ? `${label} sync failed${ageMs === null ? "" : ` · ${formatAgo(ageMs)}`}`
          : ageMs === null
            ? `${label} syncing…`
            : stale
              ? `${label} stale · ${formatAgo(ageMs)}`
              : `${label} ${formatAgo(ageMs)}`}
      </span>
      {error || stale ? (
        <button
          type="button"
          className="ml-0.5 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
          onClick={onRetry}
          aria-label={`Retry ${label.toLowerCase()} sync`}
        >
          <RefreshCw className="size-2.5" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
