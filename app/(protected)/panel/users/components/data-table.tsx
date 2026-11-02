"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { QueryFeedback } from "@/components/query-feedback";


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
  KeyRound,
  Edit,
  Filter,
  Loader2Icon,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { useSetting } from "@/components/providers/setting-provider";
import { useUser } from "../provider";
import { UserRow } from "@/schema/user";
import { Badge } from "@/components/ui/badge";
import PaginationUser from "./pagination";

export default function DataTable() {
  const { userQuery, page, setPage, search, setSearch, setSelected } =
    useUser();
  const { openModal } = useModal();
  const { userQuery: sessionQuery } = useAuth();
  const actorId = Number(sessionQuery.data?.sub);
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
          if (!profile || !("phone_number" in profile))
            return <span className="text-muted-foreground">None</span>;
          return <span>{profile.phone_number}</span>;
        },
      },
      {
        accessorKey: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            {row.original.role !== "customer" && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Change password"
                onClick={() => {
                  setSelected({
                    id: row.original.id,
                    version: row.original.version,
                  });
                  openModal(DialogMode.CHANGE_PASSWORD, {
                    title: "Change Password",
                    description: `Set a new password for ${row.original.name}.`,
                    action: "Change Password",
                  });
                }}
              >
                <KeyRound className="size-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              aria-label={`Edit user ${row.original.name}`}
              onClick={() => {
                setSelected({
                  id: row.original.id,
                  version: row.original.version,
                });
                openModal(DialogMode.EDIT, {
                  title: "Edit User",
                  description: `Update the account for ${row.original.name}.`,
                  action: "Save changes",
                });
              }}
            >
              <Edit className="size-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              aria-label={`Deactivate user ${row.original.name}`}
              disabled={row.original.id === actorId}
              title={row.original.id === actorId ? "You cannot deactivate your own account." : "Deactivate this account while retaining its history"}
              onClick={() => {
                setSelected(row.original);

                openModal(DialogMode.ARCHIVE, {
                  title: "Deactivate User",
                  description: `Deactivate ${row.original.name} (${row.original.email})? They will no longer be able to sign in. The account can be restored from Archives, and existing records are retained.`,
                  action: "Deactivate User",
                });
              }}
            >
              <Archive className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [openModal, setSelected, actorId],
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

  // Shared WebSocket invalidation refetches server-filtered rows and totals.

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
        <QueryFeedback query={userQuery} label="users" />
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
            {userQuery.isPending ? (
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
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      {userQuery.isError ? "Records unavailable. Use Retry above." : "No matching records. Try adjusting your filters."}
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
