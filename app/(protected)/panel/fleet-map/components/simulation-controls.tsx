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
            size="icon"
            variant={enabled ? "outline" : "ghost"}
            className={cn(
              "size-7",
              enabled &&
                "border-violet-400/70 bg-violet-500/10 text-violet-700 dark:text-violet-300",
            )}
            aria-label="Simulation mode"
            title="Simulation mode"
          >
            <FlaskConical className="size-3.5" aria-hidden="true" />
          </Button>
        }
      />

      <PopoverContent align="end" className="w-64 space-y-3 p-3 text-xs">
        <div className="space-y-0.5">
          <p className="font-semibold text-foreground">Simulation</p>
          <p className="text-[11px] text-muted-foreground">
            Local test movement only. Nothing is saved.
          </p>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-2">
          <span>Enable simulation</span>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </label>

        {enabled ? (
          <div className="space-y-2.5 border-t pt-2.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 w-full gap-1.5 text-xs"
              onClick={() => onRunningChange(!running)}
            >
              {running ? (
                <>
                  <Pause className="size-3" aria-hidden="true" /> Pause
                </>
              ) : (
                <>
                  <Play className="size-3" aria-hidden="true" /> Resume
                </>
              )}
            </Button>

            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span className="text-muted-foreground">Auto-dispatch next</span>
              <Switch
                checked={autoDispatch}
                onCheckedChange={onAutoDispatchChange}
              />
            </label>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
