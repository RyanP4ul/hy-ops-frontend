"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, FileClock, Loader2,
  RefreshCw, Search, SearchX, X,
} from "lucide-react";
import { QueryFeedback } from "@/components/query-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { AuditLogsTableSchemaType } from "@/schema/audit-logs";
import { useAuditLogs } from "../provider";

function readableLabel(value: string) {
  return value.replace(/[_-]+/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function logDate(value: string) {
  const numericValue = Number(value);
  const date = new Date(Number.isFinite(numericValue) ? numericValue * 1000 : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ActionBadge({ action }: { action: string }) {
  const normalized = action.toUpperCase();
  const className = /DELETE|REMOVE|FAIL|REVOKE/.test(normalized)
    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    : /CREATE|ADD|SUCCESS/.test(normalized)
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
      : /UPDATE|EDIT|CHANGE/.test(normalized)
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-border bg-muted text-muted-foreground";

  return <Badge variant="outline" className={className}>{readableLabel(action)}</Badge>;
}

function DetailValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{value || "Not recorded"}</dd>
    </div>
  );
}

function StructuredValue({ value }: { value: unknown }) {
  let formatted = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (typeof value === "string") {
    try {
      formatted = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      formatted = value;
    }
  }
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-3 text-xs">{formatted}</pre>;
}

export function DataTable() {
  const { auditLogsQuery, pageIndex, pageSize, searchQuery, setPagination, setSearchQuery } = useAuditLogs();
  const [search, setSearch] = useState(searchQuery);
  const [selectedLog, setSelectedLog] = useState<AuditLogsTableSchemaType | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search.trim() !== searchQuery) {
        setPagination((current) => ({ ...current, pageIndex: 0 }));
        setSearchQuery(search.trim());
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [search, searchQuery, setPagination, setSearchQuery]);

  const rows = auditLogsQuery.data?.rows ?? [];
  const total = auditLogsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const isSearching = search.trim() !== searchQuery;
  const isBusy = auditLogsQuery.isFetching || isSearching;
  const rangeStart = rows.length ? pageIndex * pageSize + 1 : 0;
  const rangeEnd = rows.length ? pageIndex * pageSize + rows.length : 0;

  function clearSearch() {
    setSearch("");
    setSearchQuery("");
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Activity history</h2>
              {auditLogsQuery.data && <Badge variant="secondary">{total.toLocaleString()} {searchQuery ? "matches" : "records"}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">Open an entry to review its full details and recorded changes.</p>
          </div>
          <Button variant="outline" size="sm" className="w-fit" disabled={isBusy} onClick={() => void auditLogsQuery.refetch()}>
            <RefreshCw className={`size-4 ${auditLogsQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>

        <div className="space-y-3 border-b bg-muted/20 p-4 md:px-5">
          <label htmlFor="audit-log-search" className="sr-only">Search audit logs</label>
          <InputGroup className="h-10 max-w-xl bg-background">
            <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput id="audit-log-search" placeholder="Search activity history…" value={search} onChange={(event) => setSearch(event.target.value)} />
            {search && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={clearSearch}><X /></InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          {searchQuery && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="break-all">Results for “{searchQuery}”</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearSearch}>Clear search</Button>
            </div>
          )}
        </div>

        <QueryFeedback query={auditLogsQuery} label="audit logs" />
        <div aria-busy={isBusy}>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="pl-5">Activity</TableHead>
                <TableHead className="hidden md:table-cell">Record</TableHead>
                <TableHead className="hidden sm:table-cell">Performed by</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="pr-5 text-right"><span className="sr-only">Details</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogsQuery.isPending ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-56 text-center">
                    <div role="status" className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                      <span>Loading activity history…</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length ? rows.map((log) => {
                const date = logDate(log.created_at);
                return (
                  <TableRow key={log.id}>
                    <TableCell className="max-w-44 whitespace-normal py-4 pl-5 sm:max-w-sm">
                      <div className="space-y-2">
                        <ActionBadge action={log.action} />
                        <p className="line-clamp-2 break-words text-sm font-medium">{log.description || "Activity recorded"}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">User #{log.user_id}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{readableLabel(log.entity_type)} #{log.entity_id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-sm">{readableLabel(log.entity_type)}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">#{log.entity_id}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">U</div>
                        <span className="text-sm">User #{log.user_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {date ? <time dateTime={date.toISOString()} title={date.toLocaleString()}>
                        <span className="block text-xs sm:text-sm">{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                      </time> : <span className="text-xs text-muted-foreground">Not recorded</span>}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button variant="ghost" size="sm" aria-label={`View audit log ${log.id}`} onClick={() => setSelectedLog(log)}>
                        <span className="hidden lg:inline">Details</span><ArrowUpRight className="size-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 whitespace-normal text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-4 py-8">
                      <div className="mb-2 rounded-full bg-muted p-3">{searchQuery ? <SearchX className="size-6 text-muted-foreground" /> : <FileClock className="size-6 text-muted-foreground" />}</div>
                      <p className="font-medium">{auditLogsQuery.isError ? "Activity history is unavailable" : searchQuery ? "No matching activity" : "No activity recorded yet"}</p>
                      <p className="text-sm text-muted-foreground">{auditLogsQuery.isError ? "Use Retry above to load the audit logs again." : searchQuery ? "Try a different keyword or clear your search to see all activity." : "Recorded user actions and system changes will appear here."}</p>
                      {searchQuery && <Button variant="outline" size="sm" className="mt-2" onClick={clearSearch}>Clear search</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-4 border-t bg-muted/10 p-4 md:px-5 lg:flex-row lg:items-center lg:justify-between">
          <p role="status" className="text-xs text-muted-foreground">
            {auditLogsQuery.data ? `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${total.toLocaleString()} ${searchQuery ? "matching records" : "records"}` : "Activity history"}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-start">
            <div className="flex items-center gap-2">
              <span id="audit-page-size" className="text-xs text-muted-foreground">Rows</span>
              <Select value={String(pageSize)} onValueChange={(value) => {
                if (value) setPagination({ pageIndex: 0, pageSize: Number(value) });
              }}>
                <SelectTrigger aria-labelledby="audit-page-size" className="w-16"><SelectValue /></SelectTrigger>
                <SelectContent>{[10, 20, 30, 40, 50].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <nav aria-label="Audit log pagination" className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={pageIndex === 0 || isBusy} onClick={() => setPagination((current) => ({ ...current, pageIndex: current.pageIndex - 1 }))}><ArrowLeft className="size-4" /></Button>
              <span className="text-xs tabular-nums text-muted-foreground">Page {pageIndex + 1} of {pageCount}</span>
              <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={pageIndex + 1 >= pageCount || isBusy || !rows.length} onClick={() => setPagination((current) => ({ ...current, pageIndex: current.pageIndex + 1 }))}><ArrowRight className="size-4" /></Button>
            </nav>
          </div>
        </div>
      </div>

      <Dialog open={selectedLog !== null} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Activity details</DialogTitle>
            <DialogDescription>Audit log #{selectedLog?.id}. Review the recorded action and its context.</DialogDescription>
          </DialogHeader>
          {selectedLog && <div className="space-y-5">
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <ActionBadge action={selectedLog.action} />
              <p className="break-words text-sm leading-relaxed">{selectedLog.description}</p>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <DetailValue label="Performed by" value={`User #${selectedLog.user_id}`} />
              <DetailValue label="Date and time" value={logDate(selectedLog.created_at)?.toLocaleString()} />
              <DetailValue label="Record type" value={readableLabel(selectedLog.entity_type)} />
              <DetailValue label="Record ID" value={`#${selectedLog.entity_id}`} />
              <DetailValue label="IP address" value={selectedLog.ip_address} />
              <DetailValue label="Action code" value={selectedLog.action} />
            </dl>
            <dl className="border-t pt-4"><DetailValue label="Browser / device" value={selectedLog.user_agent} /></dl>
            {([
              ["Previous value", selectedLog.old_value],
              ["New value", selectedLog.new_value],
              ["Additional context", selectedLog.metadata],
            ] as const).map(([label, value]) => value != null && value !== "" ? <section key={label} className="space-y-2">
              <h3 className="text-sm font-medium">{label}</h3>
              <StructuredValue value={value} />
            </section> : null)}
          </div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
