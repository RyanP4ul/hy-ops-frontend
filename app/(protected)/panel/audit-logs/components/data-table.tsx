"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuditLogsTableSchemaType } from "@/schema/audit-logs";
import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { Loader2Icon, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { debounce } from "@/utils/debounce";
import { useAuditLogs } from "../provider";

const columns: ColumnDef<AuditLogsTableSchemaType>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "user_id", header: "User" },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "entity_type", header: "Entity" },
  { accessorKey: "entity_id", header: "Entity ID" },
  { accessorKey: "description", header: "Description" },
  { accessorKey: "ip_address", header: "IP Address" },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) =>
      new Date(Number(row.original.created_at) * 1000).toLocaleString(),
  },
];

export function DataTable() {
  const { auditLogsQuery, pageIndex, pageSize, setPagination, setSearchQuery } =
    useAuditLogs();
  const [search, setSearch] = useState("");
  const debouncedSearch = useMemo(
    () => debounce((value: string) => setSearchQuery(value), 500),
    [setSearchQuery],
  );
  const pagination = useMemo(
    () => ({ pageIndex, pageSize }),
    [pageIndex, pageSize],
  );
  const table = useReactTable({
    data: auditLogsQuery.data?.rows ?? [],
    columns,
    pageCount: Math.ceil((auditLogsQuery.data?.total ?? 0) / pageSize),
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <div className="space-y-4">
      <InputGroup className="max-w-md">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Search audit logs..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            table.setPageIndex(0);
            debouncedSearch(event.target.value);
          }}
        />
      </InputGroup>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {auditLogsQuery.isFetching ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-40 text-center"
                >
                  <Loader2Icon className="mx-auto animate-spin" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No audit logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
              table.setPageIndex(0);
            }}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
