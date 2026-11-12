import { FlaskConical, Pause, Play } from "lucide-react";
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
 * Testing tools. Off by default: the map shows real-time GPS positions. Turning
 * simulation on swaps them for animated fake movement and never saves anything.
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
      <PopoverTrigger render={
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            "gap-1.5 bg-background/95 shadow-sm backdrop-blur",
            enabled &&
              "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300",
          )}
          aria-label="Testing tools"
        >
          <FlaskConical className="size-4" />
          <span className="hidden sm:inline">
            {enabled ? "Simulation on" : "Testing tools"}
          </span>
        </Button>
      } />

      <PopoverContent align="end" className="w-80 space-y-4">
        <div>
          <p className="text-sm font-semibold">Testing tools</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Animate vehicles with fake movement to try out the interface. While
            this is on, real-time positions are ignored and nothing is saved.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="sim-enabled" className="text-sm font-medium">
            Simulate vehicle movement
          </label>
          <Switch
            id="sim-enabled"
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
                  <Pause className="size-4" /> Pause simulation
                </>
              ) : (
                <>
                  <Play className="size-4" /> Resume simulation
                </>
              )}
            </Button>

            <div className="flex items-center justify-between gap-3">
              <label htmlFor="sim-auto" className="text-xs">
                Auto-start next scheduled trip
              </label>
              <Switch
                id="sim-auto"
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
