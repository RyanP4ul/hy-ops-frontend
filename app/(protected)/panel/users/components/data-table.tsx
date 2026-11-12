"use client";

import { LifecycleActions } from "@/components/lifecycle-actions";

import { useAuth } from "@/components/providers/auth-provider";
import { QueryFeedback } from "@/components/query-feedback";
import { ManagementListHeader, ManagementListFooter, ManagementSearch, ManagementTableView } from "@/components/management-list";


import { useModal } from "@/components/providers/modal-provider";
import { Button } from "@/components/ui/button";
import { DialogMode } from "@/types/dialog";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Archive,
  KeyRound,
  Edit,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { debounce } from "@/utils/debounce";
import { useUser } from "../provider";
import { UserRow } from "@/schema/user";
import { Badge } from "@/components/ui/badge";

export default function DataTable() {
  const { userQuery, page, setPage, search, setSearch, setSelected } =
    useUser();
  const { openModal } = useModal();
  const { userQuery: sessionQuery } = useAuth();
  const actorId = Number(sessionQuery.data?.sub);
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useMemo(() => debounce((value: string) => {
    setPage((current) => ({ ...current, pageIndex: 0 }));
    setSearch(value);
  }, 350), [setSearch, setPage]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const columns = useMemo<ColumnDef<UserRow & { version: number }>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
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
              return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">Driver</Badge>;
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
            <LifecycleActions resource="users" record={row.original} />
            {row.original.role !== "customer" && (
              <Button
                variant="ghost"
                size="icon-sm"
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
              variant="ghost"
              size="icon-sm"
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
              variant="ghost"
              size="icon-sm"
              aria-label={`Archive user ${row.original.name}`}
              disabled={row.original.id === actorId}
              title={row.original.id === actorId ? "You cannot archive your own account." : "Archive this account while retaining its history"}
              onClick={() => {
                setSelected(row.original);

                openModal(DialogMode.ARCHIVE, {
                  title: "Archive User",
                  description: `Archive ${row.original.name} (${row.original.email})? They will no longer be able to sign in. The account can be restored from Archives, and existing records are retained.`,
                  action: "Archive User",
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

  function clearSearch() {
    debouncedSearch.cancel();
    setSearchInput("");
    setSearch("");
    setPage((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader title="User directory" description="Review account roles, update details, and manage access securely." total={userQuery.data?.total} isFetching={userQuery.isFetching} onRefresh={() => void userQuery.refetch()} actions={<Button size="sm" onClick={() => openModal(DialogMode.INSERT, { title: "Add User", description: "Create a user account.", action: "Add User" })}><Plus className="size-4" aria-hidden="true" />Add user</Button>} />
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 p-4 md:px-5">
        <ManagementSearch id="users-search" value={searchInput} placeholder="Search users…" onChange={(value) => { setSearchInput(value); debouncedSearch(value); }} onClear={clearSearch} />
        {(search || searchInput) && <Button variant="ghost" size="sm" onClick={clearSearch}>Clear search</Button>}
      </div>
      <QueryFeedback query={userQuery} label="users" />
      <ManagementTableView table={table} loading={userQuery.isPending} isFetching={userQuery.isFetching} error={userQuery.isError} filtered={Boolean(search)} label="users" />
      <ManagementListFooter table={table} total={userQuery.data?.total ?? 0} isFetching={userQuery.isFetching} label="users" />
    </section>
  );
}
