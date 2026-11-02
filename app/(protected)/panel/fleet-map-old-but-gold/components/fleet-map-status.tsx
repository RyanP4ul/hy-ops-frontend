import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const SHELL =
  "flex h-[820px] min-h-[650px] w-full items-center justify-center overflow-hidden rounded-2xl border bg-background text-foreground";

export function FleetMapLoading() {
  return (
    <div className={SHELL} role="status" aria-label="Loading fleet">
      <div className="w-full max-w-sm space-y-3 p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

export function FleetMapError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className={SHELL}>
      <div className="space-y-3 p-6 text-center">
        <p className="text-sm font-semibold">Couldn&rsquo;t load the fleet</p>
        <p className="text-xs text-muted-foreground">{message}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
