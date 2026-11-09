"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArchiveRestore, ArrowUpRight } from "lucide-react";
import { ManagementListHeader, ManagementListFooter, ManagementSearch, ManagementTableView } from "@/components/management-list";
import { useModal } from "@/components/providers/modal-provider";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { QueryFeedback } from "@/components/query-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REQUESTS } from "@/constant/request";
import type { ArchiveTable } from "@/schema/archives";
import { DialogMode } from "@/types/dialog";
import { useArchive } from "../provider";

function recordType(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function recordName(record: ArchiveTable) {
  const data = record.data as Record<string, unknown>;
  return typeof data?.name === "string" && data.name.trim() ? data.name : `${recordType(record.entity_type)} #${record.entity_id}`;
}

export default function DataTable() {
  const { subscribe } = useWebSocket();
  const { openModal } = useModal();
  const { archivesQuery, page, setPage, setSelected } = useArchive();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");

  useEffect(() => subscribe(
    [REQUESTS.ARCHIVE_CREATED, REQUESTS.USER_RESTORED, REQUESTS.WAREHOUSE_RESTORED],
    () => { void queryClient.invalidateQueries({ queryKey: ["archives"] }); },
  ), [queryClient, subscribe]);

  const filteredRows = useMemo(() => (archivesQuery.data?.rows ?? []).filter((record) => {
    const keyword = search.trim().toLowerCase();
    return (entityType === "all" || record.entity_type === entityType)
      && (!keyword || [recordName(record), record.entity_id, record.entity_type, record.user?.name].some((value) => String(value ?? "").toLowerCase().includes(keyword)));
  }), [archivesQuery.data?.rows, search, entityType]);

  const columns: ColumnDef<ArchiveTable>[] = [
    {
      accessorKey: "entity_id",
      header: "Archived record",
      cell: ({ row }) => <div className="min-w-40 space-y-1">
        <p className="font-medium">{recordName(row.original)}</p>
        <p className="font-mono text-xs text-muted-foreground">Record #{row.original.entity_id} · Archive #{row.original.id}</p>
      </div>,
    },
    {
      accessorKey: "entity_type",
      header: "Record type",
      cell: ({ row }) => <Badge variant="outline">{recordType(row.original.entity_type)}</Badge>,
    },
    {
      accessorKey: "archived_by",
      header: "Archived by",
      cell: ({ row }) => <span className="text-sm">{row.original.user?.name ?? "Unknown user"}</span>,
    },
    {
      id: "archived_at",
      header: "Archived on",
      cell: ({ row }) => {
        const timestamp = (row.original as ArchiveTable & { archived_at?: number }).archived_at;
        if (timestamp == null) return <span className="text-xs text-muted-foreground">Not recorded</span>;
        const date = new Date(Number(timestamp) * 1000);
        if (!Number.isFinite(date.getTime())) return <span className="text-xs text-muted-foreground">Not recorded</span>;
        return <time dateTime={date.toISOString()} title={date.toLocaleString()}>
          <span className="block text-sm">{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
        </time>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" aria-label={`View details for ${recordName(row.original)}`} onClick={() => {
          setSelected({ archived_id: row.original.id, entity_id: row.original.entity_id, entity_table: row.original.entity_type });
          openModal(DialogMode.DEFAULT, { title: "Archive details", description: `Review the archived record for ${recordName(row.original)}.`, action: "none" });
        }}>
          <span className="hidden sm:inline">Details</span><ArrowUpRight className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="outline" size="sm" aria-label={`Restore ${recordName(row.original)}`} onClick={() => {
          setSelected({ archived_id: row.original.id, entity_id: row.original.entity_id, entity_table: row.original.entity_type });
          openModal(DialogMode.ARCHIVE, { title: "Restore record?", description: `Restore ${recordName(row.original)}? This record will become active again and will be removed from Archives.`, action: "Restore record" });
        }}>
          <ArchiveRestore className="size-4" aria-hidden="true" /><span>Restore</span>
        </Button>
      </div>,
    },
  ];

  const table = useReactTable({
    data: filteredRows,
    columns,
    pageCount: Math.ceil((archivesQuery.data?.total ?? 0) / page.pageSize),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });
  const filtered = Boolean(search.trim() || entityType !== "all");
  const typeOptions = [
    { value: "all", label: "All record types" },
    ...Array.from(new Set([...(archivesQuery.data?.rows ?? []).map((record) => record.entity_type), ...(entityType !== "all" ? [entityType] : [])])).map((value) => ({ value, label: recordType(value) })),
  ];

  function resetFilters() {
    setSearch("");
    setEntityType("all");
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader title="Archived records" description="Review record details before restoring an account or warehouse."
        total={archivesQuery.data?.total} isFetching={archivesQuery.isFetching} onRefresh={() => void archivesQuery.refetch()} />
      <div className="space-y-3 border-b bg-muted/20 p-4 md:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <ManagementSearch id="archive-search" value={search} placeholder="Search records on this page…" onChange={setSearch} onClear={() => setSearch("")} />
          <Select items={typeOptions} value={entityType} onValueChange={(value) => setEntityType(value ?? "all")}>
            <SelectTrigger className="h-10 w-full bg-background sm:w-48" aria-label="Filter record types on this page"><SelectValue /></SelectTrigger>
            <SelectContent>{typeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          {filtered && <Button variant="ghost" size="sm" onClick={resetFilters}>Reset filters</Button>}
        </div>
        <p className="text-xs text-muted-foreground">Search and record-type filters apply to the current page. Use pagination to browse other archived records.</p>
      </div>
      <QueryFeedback query={archivesQuery} label="archived records" />
      <ManagementTableView table={table} loading={archivesQuery.isPending} isFetching={archivesQuery.isFetching} error={archivesQuery.isError} filtered={filtered} label="archived records" />
      <ManagementListFooter table={table} total={archivesQuery.data?.total ?? 0} isFetching={archivesQuery.isFetching} label="Archives" pageFiltered={filtered} />
    </section>
  );
}
