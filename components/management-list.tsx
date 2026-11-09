"use client";

import type { ReactNode } from "react";
import { flexRender, type Table } from "@tanstack/react-table";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Search, SearchX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table as TableRoot, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ManagementPageHeading({ title, description, icon }: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background text-primary" aria-hidden="true">{icon}</div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function ManagementListHeader({ title, description, total, isFetching, onRefresh, actions }: {
  title: string;
  description: string;
  total?: number;
  isFetching: boolean;
  onRefresh: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{title}</h2>
          {total !== undefined && <Badge variant="secondary">{total.toLocaleString()} records</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={isFetching} onClick={onRefresh}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </Button>
        {actions}
      </div>
    </div>
  );
}

export function ManagementSearch({ id, value, placeholder, onChange, onClear }: {
  id: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <InputGroup className="h-10 w-full bg-background sm:max-w-md">
      <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
      <InputGroupInput id={id} aria-label={placeholder} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      {value && <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={onClear}><X /></InputGroupButton>
      </InputGroupAddon>}
    </InputGroup>
  );
}

export function ManagementTableState({ loading, error, filtered, label }: {
  loading?: boolean;
  error?: boolean;
  filtered?: boolean;
  label: string;
}) {
  return (
    <div role={loading ? "status" : undefined} className="mx-auto flex max-w-sm flex-col items-center gap-2 px-4 py-10 text-center">
      <div className="mb-2 rounded-full bg-muted p-3">
        {loading ? <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" /> : <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />}
      </div>
      <p className="font-medium">{loading ? `Loading ${label}…` : error ? `Unable to load ${label}` : filtered ? `No matching ${label}` : `No ${label} yet`}</p>
      {!loading && <p className="text-sm text-muted-foreground">{error ? "Use Retry above to load these records again." : filtered ? "Try a different keyword or reset your filters." : "New records will appear here when added."}</p>}
    </div>
  );
}

export function ManagementTableView<TData>({ table, loading, isFetching, error, filtered, label }: {
  table: Table<TData>;
  loading: boolean;
  isFetching: boolean;
  error: boolean;
  filtered: boolean;
  label: string;
}) {
  return (
    <div aria-busy={isFetching}>
      <TableRoot>
        <TableHeader className="bg-muted/30">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id} className="px-5">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length}><ManagementTableState loading label={label} /></TableCell></TableRow>
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-5 py-4">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length}><ManagementTableState error={error} filtered={filtered} label={label} /></TableCell></TableRow>
          )}
        </TableBody>
      </TableRoot>
    </div>
  );
}

export function ManagementListFooter<TData>({ table, total, isFetching, label, pageFiltered = false }: {
  table: Table<TData>;
  total: number;
  isFetching: boolean;
  label: string;
  pageFiltered?: boolean;
}) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const count = table.getRowModel().rows.length;
  const start = count ? pageIndex * pageSize + 1 : 0;
  const end = count ? pageIndex * pageSize + count : 0;
  return (
    <div className="flex flex-col gap-4 border-t bg-muted/10 p-4 md:px-5 lg:flex-row lg:items-center lg:justify-between">
      <p role="status" className="text-xs text-muted-foreground">{pageFiltered ? `${count.toLocaleString()} visible on this page · ${total.toLocaleString()} records across all pages` : `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()} records`}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-start">
        <div className="flex items-center gap-2">
          <span id={`${label}-page-size`} className="text-xs text-muted-foreground">Rows</span>
          <Select value={String(pageSize)} onValueChange={(value) => {
            if (value) table.setPagination({ pageIndex: 0, pageSize: Number(value) });
          }}>
            <SelectTrigger aria-labelledby={`${label}-page-size`} className="w-16"><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 20, 30, 40, 50].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <nav aria-label={`${label} pagination`} className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={!table.getCanPreviousPage() || isFetching} onClick={() => table.previousPage()}><ArrowLeft className="size-4" /></Button>
          <span className="text-xs tabular-nums text-muted-foreground">Page {pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
          <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={!table.getCanNextPage() || isFetching} onClick={() => table.nextPage()}><ArrowRight className="size-4" /></Button>
        </nav>
      </div>
    </div>
  );
}
