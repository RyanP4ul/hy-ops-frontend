import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const SHELL =
  "flex h-[calc(100dvh-var(--header-height)-1rem)] min-h-[520px] w-full items-center justify-center overflow-hidden rounded-xl border bg-background text-foreground";

export function FleetMapLoading() {
  return (
    <div
      className="relative flex h-[calc(100dvh-var(--header-height)-1rem)] min-h-[520px] w-full flex-col overflow-hidden rounded-xl border bg-background text-foreground"
      role="status"
      aria-label="Loading fleet dispatch workspace"
      aria-busy="true"
    >
      <span className="sr-only">
        Loading vehicles, warehouses, and map controls...
      </span>

      {/* Header skeleton */}
      <div
        aria-hidden="true"
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
      >
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40 motion-reduce:animate-none" />
          <Skeleton className="h-3.5 w-64 max-w-[60vw] motion-reduce:animate-none" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-52 motion-reduce:animate-none" />
          <Skeleton className="h-8 w-24 motion-reduce:animate-none" />
        </div>
      </div>

      {/* Body skeleton */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          aria-hidden="true"
          className="hidden w-[320px] shrink-0 border-r lg:block"
          data-testid="fleet-loading-sidebar"
        >
          <div className="space-y-3 border-b p-3">
            <Skeleton className="h-9 w-full motion-reduce:animate-none" />
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton
                  key={item}
                  className="h-7 w-16 rounded-md motion-reduce:animate-none"
                />
              ))}
            </div>
          </div>
          <div className="space-y-2.5 p-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-24 motion-reduce:animate-none" />
                  <Skeleton className="h-5 w-16 rounded-md motion-reduce:animate-none" />
                </div>
                <Skeleton className="h-3 w-36 motion-reduce:animate-none" />
                <Skeleton className="h-3 w-2/3 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="relative min-w-0 flex-1 bg-muted/30"
          data-testid="fleet-loading-map"
        >
          <div className="absolute left-3 top-3 flex gap-2">
            <Skeleton className="h-8 w-36 rounded-md motion-reduce:animate-none" />
            <Skeleton className="hidden h-8 w-28 rounded-md sm:block motion-reduce:animate-none" />
          </div>
          <div className="absolute bottom-4 right-3 space-y-2 rounded-md border bg-background p-2">
            {[0, 1, 2].map((item) => (
              <Skeleton
                key={item}
                className="size-7 motion-reduce:animate-none"
              />
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
    <div className={SHELL} role="alert">
      <div className="max-w-sm space-y-3 p-6 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold">Unable to load fleet workspace</p>
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
