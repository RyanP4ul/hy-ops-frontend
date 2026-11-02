"use client";
import { Button } from "@/components/ui/button";
type QueryState = { isError: boolean; isFetching: boolean; data?: unknown; refetch: () => unknown };

export function QueryFeedback({ query, label = "records" }: { query: QueryState; label?: string }) {
  if (query.isError) return <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
    <span>Unable to {query.data ? "refresh" : "load"} {label}.{query.data ? " Showing the last loaded records." : " Try again."}</span>
    <Button type="button" variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>Retry</Button>
  </div>;
  if (query.isFetching && query.data) return <p role="status" className="px-3 text-xs text-muted-foreground">Refreshing {label}...</p>;
  return null;
}
