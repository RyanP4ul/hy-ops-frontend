import { FlaskConical, Pause, Play, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type SimulationControlsProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  running: boolean;
  onRunningChange: (running: boolean) => void;
  autoDispatch: boolean;
  onAutoDispatchChange: (autoDispatch: boolean) => void;
};

/**
 * Development / testing simulation sandbox. Kept discreet in a secondary popover
 * so everyday dispatch operations remain uncluttered.
 */
export function SimulationControls({
  enabled,
  onEnabledChange,
  running,
  onRunningChange,
  autoDispatch,
  onAutoDispatchChange,
}: SimulationControlsProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant={enabled ? "outline" : "ghost"}
            className={cn(
              "h-8 gap-1.5 px-2 text-xs",
              enabled &&
                "border-violet-500/60 bg-violet-500/10 text-violet-800 dark:text-violet-200",
            )}
            aria-label="Development testing tools"
            title="Development testing tools"
          >
            {enabled ? (
              <FlaskConical className="size-3.5" aria-hidden="true" />
            ) : (
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden xl:inline">
              {enabled ? "Simulating" : "Dev tools"}
            </span>
          </Button>
        }
      />

      <PopoverContent align="end" className="w-80 space-y-4">
        <div>
          <p className="text-sm font-semibold">Sandbox simulation</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Testing only. Replaces real GPS fixes with simulated client-side
            movement. Changes are never saved to the server.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="sim-1-enabled" className="text-sm font-medium">
            Simulate vehicle movement
          </label>
          <Switch
            id="sim-1-enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>

        {enabled ? (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => onRunningChange(!running)}
            >
              {running ? (
                <>
                  <Pause className="size-4" aria-hidden="true" /> Pause
                  simulation
                </>
              ) : (
                <>
                  <Play className="size-4" aria-hidden="true" /> Resume
                  simulation
                </>
              )}
            </Button>

            <div className="flex items-center justify-between gap-3">
              <label htmlFor="sim-1-auto" className="text-xs">
                Auto-start next scheduled trip
              </label>
              <Switch
                id="sim-1-auto"
                checked={autoDispatch}
                onCheckedChange={onAutoDispatchChange}
              />
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
