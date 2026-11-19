import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function FleetMapLoading() {
  return (
    <div
      className="relative flex h-[calc(100dvh-var(--header-height)-1rem)] min-h-[540px] w-full flex-col overflow-hidden rounded-xl border bg-background text-foreground"
      role="status"
      aria-label="Loading fleet map"
      aria-busy="true"
    >
      <span className="sr-only">Loading fleet map…</span>

      <div
        aria-hidden="true"
        className="flex h-11 items-center justify-between border-b px-3.5"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24 motion-reduce:animate-none" />
          <Skeleton className="h-5 w-14 rounded-full motion-reduce:animate-none" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-28 rounded-md motion-reduce:animate-none" />
          <Skeleton className="size-7 rounded-md motion-reduce:animate-none" />
        </div>
      </div>

      <div className="relative flex-1 bg-muted/25">
        <div
          aria-hidden="true"
          className="absolute bottom-3 left-3 top-3 hidden w-[336px] flex-col rounded-xl border bg-background p-3 shadow-sm lg:flex"
        >
          <Skeleton className="h-8 w-full rounded-md motion-reduce:animate-none" />
          <div className="mt-2.5 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                className="h-6 w-14 rounded-md motion-reduce:animate-none"
              />
            ))}
          </div>
          <div className="mt-3 divide-y">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-1.5 py-2.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24 motion-reduce:animate-none" />
                  <Skeleton className="h-3.5 w-14 motion-reduce:animate-none" />
                </div>
                <Skeleton className="h-3 w-40 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
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
    <div
      className="flex h-[calc(100dvh-var(--header-height)-1rem)] min-h-[540px] w-full items-center justify-center rounded-xl border bg-background p-6 text-foreground"
      role="alert"
    >
      <div className="max-w-xs space-y-3 text-center">
        <p className="text-sm font-semibold">Couldn&apos;t load fleet map</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
