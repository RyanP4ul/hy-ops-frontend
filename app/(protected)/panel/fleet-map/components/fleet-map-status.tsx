import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const SHELL =
  "flex h-full min-h-[560px] w-full items-center justify-center overflow-hidden rounded-xl border bg-background text-foreground";

export function FleetMapLoading() {
  return (
    <div className="relative flex h-full min-h-[560px] w-full overflow-hidden rounded-xl border bg-background text-foreground" role="status" aria-label="Loading fleet" aria-busy="true">
      <span className="sr-only">Loading vehicles, warehouses and map...</span>
      <div aria-hidden="true" className="hidden w-[360px] shrink-0 border-r lg:block" data-testid="fleet-loading-sidebar">
        <div className="space-y-3 border-b p-3">
          <Skeleton className="h-5 w-32 motion-reduce:animate-none" />
          <Skeleton className="h-9 w-full motion-reduce:animate-none" />
        </div>
        <div className="space-y-3 p-3">
          <Skeleton className="h-9 w-full motion-reduce:animate-none" />
          <div className="flex gap-2">
            {[0, 1, 2].map(item => <Skeleton key={item} className="h-7 w-20 motion-reduce:animate-none" />)}
          </div>
          {[0, 1, 2].map(item => <div key={item} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3"><Skeleton className="h-4 w-24 motion-reduce:animate-none" /><Skeleton className="h-5 w-16 rounded-full motion-reduce:animate-none" /></div>
            <Skeleton className="h-3 w-36 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-3/4 motion-reduce:animate-none" />
            <Skeleton className="h-1.5 w-full motion-reduce:animate-none" />
          </div>)}
        </div>
      </div>
      <div aria-hidden="true" className="relative min-w-0 flex-1 bg-muted/30" data-testid="fleet-loading-map">
        <div className="absolute inset-x-3 top-3 flex items-center gap-2">
          <Skeleton className="size-9 shrink-0 lg:hidden motion-reduce:animate-none" />
          <Skeleton className="h-9 w-36 max-w-[55%] motion-reduce:animate-none" />
          <div className="hidden gap-2 md:flex">
            {[0, 1, 2].map(item => <Skeleton key={item} className="h-8 w-20 rounded-full motion-reduce:animate-none" />)}
          </div>
          <Skeleton className="ml-auto size-9 shrink-0 motion-reduce:animate-none" />
        </div>
        <div className="absolute left-3 top-16 w-60 max-w-[calc(100%-4rem)] rounded-lg border bg-background p-3">
          <Skeleton className="h-4 w-full motion-reduce:animate-none" />
        </div>
        <div className="absolute bottom-3 right-3 space-y-2 rounded-lg border bg-background p-2">
          {[0, 1, 2].map(item => <Skeleton key={item} className="size-7 motion-reduce:animate-none" />)}
        </div>
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
