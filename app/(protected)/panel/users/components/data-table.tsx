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
  ArrowDownUp,
  Edit,
  Filter,
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
import { useUser } from "../provider";
import { UserRow } from "@/schema/user";
import { Badge } from "@/components/ui/badge";
import PaginationUser from "./pagination";

export default function DataTable() {
  const { subscribe } = useWebSocket();
  const { userQuery, page, setPage, search, setSearch, setSelected } =
    useUser();
  const { openModal } = useModal();
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useMemo(() => debounce(setSearch, 500), [setSearch]);

  const columns = useMemo<ColumnDef<UserRow & { version: number }>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
          const role = row.original.role;

          switch (role) {
            case "admin":
              return <Badge variant="default">Admin</Badge>;
            case "staff":
              return <Badge variant="secondary">Staff</Badge>;
            case "customer":
              return <Badge variant="outline">Customer</Badge>;
            case "driver":
              return <Badge variant="destructive">Driver</Badge>;
            default:
              return <Badge variant="ghost">Unknown</Badge>;
          }
        },
      },
      {
        accessorKey: "email",
        header: "Email",
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => {
          const profile =
            "profile" in row.original ? row.original.profile : undefined;
          if (!profile)
            return <span className="text-muted-foreground">None</span>;
          return <span>{profile.phone_number}</span>;
        },
      },
      {
        accessorKey: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Edit warehouse"
              onClick={() => {
                setSelected({
                  id: row.original.id,
                  version: row.original.version,
                });
                openModal(DialogMode.EDIT, {
                  title: "Edit Warehouse",
                  description: "Update this warehouse.",
                  action: "Save changes",
                });
              }}
            >
              <Edit className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Delete warehouse"
              className="text-destructive"
              onClick={() => {
                setSelected(row.original);
                openModal(DialogMode.DELETE, {
                  title: "Delete Warehouse",
                  description: `Are you sure you want to delete the warehouse "${row.original.name}"? This action cannot be undone.`,
                  action: "Delete",
                });
              }}
            >
              <Trash2 className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Archive warehouse"
              onClick={() => {
                setSelected(row.original);

                openModal(DialogMode.ARCHIVE, {
                  title: "Archive Warehouse",
                  description: `Are you sure you want to archive the warehouse "${row.original.name}"? This action cannot be undone.`,
                  action: "Archive",
                });
              }}
            >
              <Archive className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [openModal, setSelected],
  );
  const table = useReactTable({
    data: userQuery.data?.rows ?? [],
    columns,
    pageCount: Math.ceil((userQuery.data?.total ?? 0) / page.pageSize),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    console.log("Setting up WebSocket subscriptions for user updates");
    return subscribe(
      [
        REQUESTS.USER_ADDED,
        REQUESTS.USER_ARCHIVED,
        REQUESTS.USER_DELETED,
        REQUESTS.USER_UPDATED,
        REQUESTS.USER_RESTORED,
      ],
      (message) => {
        const query_key = ["users", page.pageIndex, page.pageSize, search];

        const payload = message.payload;
        const userId =
          typeof payload === "object" && payload !== null
            ? payload.id
            : Array.isArray(payload)
              ? payload[payload.length - 1]
              : payload;

        switch (message.type) {
          case REQUESTS.USER_ADDED:
          case REQUESTS.USER_RESTORED:
            queryClient.setQueryData(query_key, (oldData: any) => {
              if (!oldData) return { rows: [payload], total: 1 };

              return {
                rows: [payload, ...oldData.rows].slice(0, page.pageSize),
                total: oldData.total + 1,
              };
            });
            break;
          case REQUESTS.USER_ARCHIVED:
          case REQUESTS.USER_DELETED:
            queryClient.setQueryData(query_key, (oldData: any) => {
              if (!oldData) return oldData;

              const rows = oldData.rows.filter(
                (row: UserRow) => row.id !== userId,
              );
              return {
                rows,
                total: Math.max(
                  0,
                  oldData.total - (rows.length < oldData.rows.length ? 1 : 0),
                ),
              };
            });
            break;
          case REQUESTS.USER_UPDATED:
            queryClient.setQueryData(query_key, (oldData: any) => {
              if (!oldData) return oldData;

              return {
                ...oldData,
                rows: oldData.rows.map((row: UserRow) =>
                  row.id === userId ? payload : row,
                ),
              };
            });
            break;
        }
      },
    );
  }, [page.pageIndex, page.pageSize, queryClient, search, subscribe]);

  return (
    <>
      <div className="flex flex-wrap items-end gap-6 mb-3">
        <div className="flex flex-col gap-2">
          <InputGroup className="max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search users..."
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage((current) => ({ ...current, pageIndex: 0 }));
                debouncedSearch(event.target.value);
              }}
            />
          </InputGroup>
        </div>
      </div>

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
            {userQuery.isFetching ? (
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
          <PaginationUser table={table} />
        </div>
      </div>
    </>
  );
}
