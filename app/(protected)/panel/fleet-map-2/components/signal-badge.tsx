import { FlaskConical, Radio, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAgo } from "../lib/format";
import type { ResolvedPosition } from "../types";

/** Tells the dispatcher how much to trust the position drawn on the map. */
export function SignalBadge({
  position,
  className,
}: {
  position: ResolvedPosition;
  className?: string;
}) {
  const base = "inline-flex items-center gap-1 text-xs font-medium";

  switch (position.signal) {
    case "live":
      return (
        <span
          className={cn(
            base,
            "text-emerald-700 dark:text-emerald-400",
            className,
          )}
        >
          <Radio className="size-3.5" />
          Live · {formatAgo(position.ageMs ?? 0)}
        </span>
      );
    case "stale":
      return (
        <span
          className={cn(base, "text-amber-700 dark:text-amber-400", className)}
        >
          <WifiOff className="size-3.5" />
          {position.ageMs === null
            ? "GPS timestamp unavailable"
            : `Last seen ${formatAgo(position.ageMs)}`}
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
          <FlaskConical className="size-3.5" />
          Simulated
        </span>
      );
    case "none":
      return (
        <span className={cn(base, "text-muted-foreground", className)}>
          <WifiOff className="size-3.5" />
          No signal
        </span>
      );
  }
}
