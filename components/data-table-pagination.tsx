"use client";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";

export function DataTablePagination<TData>({ table }: { table: Table<TData> }) {
  const { pageIndex } = table.getState().pagination;
  const pages = table.getPageCount();
  return <nav aria-label="Table pagination" className="flex w-full flex-wrap items-center justify-center gap-1 py-3">
    <Button type="button" variant="ghost" size="icon" aria-label="First page" disabled={!table.getCanPreviousPage()} onClick={() => table.setPageIndex(0)}><ChevronFirst /></Button>
    <Button type="button" variant="ghost" size="icon" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft /></Button>
    <span role="status" className="px-2 text-sm tabular-nums">Page {pages ? pageIndex + 1 : 0} of {pages}</span>
    <Button type="button" variant="ghost" size="icon" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}><ChevronRight /></Button>
    <Button type="button" variant="ghost" size="icon" aria-label="Last page" disabled={!table.getCanNextPage()} onClick={() => table.setPageIndex(Math.max(0, pages - 1))}><ChevronLast /></Button>
  </nav>;
}
