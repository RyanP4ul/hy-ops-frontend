import {
  Clock,
  FlaskConical,
  MapPinOff,
  Radio,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAgo } from "../lib/format";
import type { ResolvedPosition } from "../types";

/**
 * Independent GPS health indicator. Never conflates vehicle operational status
 * or WebSocket channel state with GPS fix freshness.
 */
export function SignalBadge({
  position,
  compact = false,
  className,
}: {
  position: ResolvedPosition;
  compact?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap";

  switch (position.health) {
    case "fresh":
      return (
        <span
          className={cn(
            base,
            "text-emerald-700 dark:text-emerald-400",
            className,
          )}
        >
          <Radio className="size-3.5 shrink-0" aria-hidden="true" />
          {compact
            ? `GPS fresh · ${formatAgo(position.ageMs ?? 0)}`
            : `GPS fresh · ${formatAgo(position.ageMs ?? 0)}`}
        </span>
      );
    case "delayed":
      return (
        <span
          className={cn(
            base,
            "text-amber-700 dark:text-amber-400",
            className,
          )}
        >
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          {compact
            ? `GPS delayed · ${formatAgo(position.ageMs ?? 0)}`
            : `Delayed · ${formatAgo(position.ageMs ?? 0)}`}
        </span>
      );
    case "stale":
      return (
        <span
          className={cn(
            base,
            "text-orange-700 dark:text-orange-400",
            className,
          )}
        >
          <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
          {position.ageMs === null
            ? "GPS timestamp invalid"
            : `Last known · ${formatAgo(position.ageMs)}`}
        </span>
      );
    case "simulated":
      return (
        <span
          className={cn(
            base,
            "text-violet-700 dark:text-violet-300",
            className,
          )}
        >
          <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
          Simulated
        </span>
      );
    case "none":
      return (
        <span className={cn(base, "text-muted-foreground", className)}>
          <MapPinOff className="size-3.5 shrink-0" aria-hidden="true" />
          {compact ? "No GPS" : "No GPS signal"}
        </span>
      );
  }
}
