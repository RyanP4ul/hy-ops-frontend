"use client";

import { ModalProvider, useModal } from "@/components/providers/modal-provider";
import { Button } from "@/components/ui/button";
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
import { DialogMode } from "@/types/dialog";
import {
  flexRender,
  getCoreRowModel,
  SortingState,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Archive,
  ArchiveRestore,
  ArrowDownUp,
  Edit,
  Filter,
  Info,
  Loader2Icon,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { debounce } from "@/utils/debounce";
import { WarehouseRow } from "@/schema/warehouse";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REQUESTS } from "@/constant/request";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useSetting } from "@/components/providers/setting-provider";
import { useArchive } from "../provider";
import { ArchiveForm, ArchiveRow, ArchiveTable } from "@/schema/archives";
import PaginationArchive from "./pagination";

export default function DataTable() {
  const { subscribe } = useWebSocket();
  const { openModal } = useModal();
  const { archivesQuery, page, setPage, setSelected } = useArchive();

  const queryClient = useQueryClient();

  useEffect(() => {
    console.log("Setting up WebSocket subscriptions for archive updates");
    return subscribe([REQUESTS.ARCHIVE_CREATED], (message) => {
      const query_key = ["archives"];
      switch (message.type) {
        case REQUESTS.ARCHIVE_CREATED:
          queryClient.setQueryData(query_key, (oldData: any) => {
            if (!oldData) {
              return {
                rows: [message.payload],
                total: 1,
              };
            }

            return {
              rows: [message.payload, ...oldData.rows].slice(0, page.pageSize),
              total: oldData.total + 1,
            };
          });
          break;
      }
    });
  }, [subscribe]);

  const columns = useMemo<ColumnDef<ArchiveTable>[]>(
    () => [
      { accessorKey: "entity_id", header: "Entity ID" },
      { accessorKey: "entity_type", header: "Entity Type" },
      // {
      //   accessorKey: "data",
      //   header: "Data",
      //   cell: ({ row }) =>
      //     JSON.stringify(row.original.data, null, 2).slice(0, 100) + "...",
      // },
      {
        accessorKey: "archived_by",
        header: "Archived By",
        cell: ({ row }) => {
          return (
            <a
              className="font-medium text-blue-700 border-b border-blue-700 hover:text-blue-900 hover:border-blue-900"
              href="#"
            >
              {row.original.user?.name ?? "Unknown"}
            </a>
          );
        },
      },
      {
        accessorKey: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelected({
                  archived_id: row.original.id,
                  entity_id: row.original.entity_id,
                  entity_table: row.original.entity_type,
                });
                openModal(DialogMode.DEFAULT, {
                  title: "Archive Details",
                  description: `Details of the archive "${row.original.entity_id} ${row.original.entity_type}".`,
                  action: "none",
                });
              }}
            >
              <Info className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log(
                  "Restoring archive with ID:",
                  row.original.entity_id,
                );
                setSelected({
                  archived_id: row.original.id,
                  entity_id: row.original.entity_id,
                  entity_table: row.original.entity_type,
                });
                openModal(DialogMode.ARCHIVE, {
                  title: "Restore Archive",
                  description: `Are you sure you want to restore the archive "${row.original.entity_id} ${row.original.entity_type}"? This action cannot be undone.`,
                  action: "Restore",
                });
              }}
            >
              <ArchiveRestore className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: archivesQuery.data?.rows ?? [],
    columns,
    pageCount: Math.ceil((archivesQuery.data?.total ?? 0) / page.pageSize),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {archivesQuery.isFetching ? (
              <TableRow>
                <TableCell colSpan={10} className="h-40 text-center">
                  <div className="flex items-center justify-center">
                    <Loader2Icon className="mr-2 animate-spin h-4 w-4" />
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {cell.column.columnDef.cell
                            ? (cell.column.columnDef.cell as any)(
                                cell.getContext(),
                              )
                            : cell.getValue()}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      No Results Found
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex w-full items-center px-4">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          <Field orientation="horizontal" className="w-fit">
            <FieldLabel htmlFor="select-rows-per-page">
              Rows per page
            </FieldLabel>

            <Select
              defaultValue="10"
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="w-20" id="select-rows-per-page">
                <SelectValue />
              </SelectTrigger>

              <SelectContent align="start">
                <SelectGroup>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="40">40</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex items-center justify-end">
          <PaginationArchive table={table} />
        </div>
      </div>
    </>
  );
}
