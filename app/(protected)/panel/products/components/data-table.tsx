"use client";

import { LifecycleActions } from "@/components/lifecycle-actions";

import { QueryFeedback } from "@/components/query-feedback";
import {
  ManagementListHeader,
  ManagementListFooter,
  ManagementSearch,
  ManagementTableState,
} from "@/components/management-list";

import { useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Edit, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductType } from "@/schema/product";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts } from "../provider";
import { debounce } from "@/utils/debounce";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";

export default function DataTable() {
  const { openModal } = useModal();
  const {
    query,
    page,
    setPage,
    setSelected,
    setSearchQuery,
    searchQuery,
    variantFilter,
    setVariantFilter,
  } = useProducts();

  const columns: ColumnDef<ProductType>[] = [
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => (
        <Button
          variant="link"
          className="h-auto whitespace-normal p-0 text-left font-medium"
          onClick={() => {
            setSelected({
              id: row.original.id || -1,
              version: row.original.version || 0,
            });
            openModal(DialogMode.EDIT, {
              title: "Edit Product",
              description: "Update this product and its variants.",
              action: "Save changes",
            });
          }}
        >
          {row.original.name}
        </Button>
      ),
    },
    {
      accessorKey: "variants",
      header: "Variants",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <details>
            <summary className="w-fit cursor-pointer rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
              {row.original.variants.length}{" "}
              {row.original.variants.length === 1 ? "variant" : "variants"}
            </summary>
            <ul className="min-w-64 space-y-2 py-2 text-sm">
              {row.original.variants.map((variant) => (
                <li key={variant.id ?? variant.sku}>
                  <p className="font-medium">
                    {variant.name} - {variant.sku}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {variant.price} PHP / {variant.unit}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ),
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Edit ${row.original.name}`}
            onClick={() => {
              setSelected({
                id: row.original.id || -1,
                version: row.original.version || 0,
              });
              openModal(DialogMode.EDIT, {
                title: "Edit Product",
                description: "Update this product.",
                action: "Save changes",
              });
            }}
          >
            <Edit className="size-4" />{" "}
            <span className="hidden sm:inline">Edit</span>
          </Button>
          <LifecycleActions resource="products" record={row.original} archive />
        </div>
      ),
    },
  ];

  const [search, setSearch] = useState<string>(searchQuery);

  const table = useReactTable({
    data: query.data?.rows ?? [],
    columns,
    pageCount: Math.ceil((query.data?.total ?? 0) / page.pageSize),
    state: { pagination: page },
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  // Shared resource invalidation preserves the server search/filter result.

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setPage((page) => ({ ...page, pageIndex: 0 }));
        setSearchQuery(value);
      }, 500),
    [setSearchQuery, setPage],
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const filtered = Boolean(searchQuery || variantFilter !== "all");
  function clearFilters() {
    debouncedSearch.cancel();
    setSearch("");
    setSearchQuery("");
    setVariantFilter("all");
    setPage((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ManagementListHeader
        title="Product catalog"
        description="Search your catalog or expand a product to review its variants, prices, and units."
        total={query.data?.total}
        isFetching={query.isFetching}
        onRefresh={() => void query.refetch()}
        actions={
          <Button
            size="sm"
            onClick={() =>
              openModal(DialogMode.INSERT, {
                title: "Add Product",
                description: "Create a new product.",
                action: "Add Product",
              })
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Add product
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 p-4 md:px-5">
        <ManagementSearch
          id="product-search"
          value={search}
          placeholder="Search products, variants, or SKU…"
          onChange={(value) => {
            setSearch(value);
            debouncedSearch(value);
          }}
          onClear={() => {
            debouncedSearch.cancel();
            setSearch("");
            setSearchQuery("");
            setPage((current) => ({ ...current, pageIndex: 0 }));
          }}
        />
        <Select
          items={[
            { value: "all", label: "All products" },
            { value: "with", label: "With variants" },
            { value: "without", label: "Without variants" },
          ]}
          value={variantFilter}
          onValueChange={(value) => {
            if (value) {
              setVariantFilter(value);
              setPage((current) => ({ ...current, pageIndex: 0 }));
            }
          }}
        >
          <SelectTrigger
            aria-label="Filter products by variants"
            className="h-10 w-full bg-background sm:w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            <SelectItem value="with">With variants</SelectItem>
            <SelectItem value="without">Without variants</SelectItem>
          </SelectContent>
        </Select>
        {(filtered || search) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Reset filters
          </Button>
        )}
      </div>
      <QueryFeedback query={query} label="products" />
      <div aria-busy={query.isFetching}>
        <Table>
          <TableHeader className="bg-muted/30">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} className="px-5">
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
            {query.isPending ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <ManagementTableState loading label="products" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-5 py-4">
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
                <TableCell colSpan={columns.length}>
                  <ManagementTableState
                    error={query.isError}
                    filtered={filtered}
                    label="products"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <ManagementListFooter
        table={table}
        total={query.data?.total ?? 0}
        isFetching={query.isFetching}
        label="Products"
      />
    </section>
  );
}
