"use client";

import { QueryFeedback } from "@/components/query-feedback";


import { useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  PaginationState,
  useReactTable,
  getSortedRowModel,
  ExpandedState,
  getExpandedRowModel,
} from "@tanstack/react-table";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Loader2Icon,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductType, ProductVariantType } from "@/schema/product";
import { Badge } from "@/components/ui/badge";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { useProducts } from "../provider";
import PaginationProduct from "./pagination";
import { debounce } from "@/utils/debounce";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import Form from "./form";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { useQueryClient } from "@tanstack/react-query";

type ProductQueryData = {
  rows: ProductType[];
  total: number;
};

export default function DataTable() {
  const { openModal } = useModal();
  const { query, page, setPage, setSelected, setSearchQuery, searchQuery, variantFilter, setVariantFilter } =
    useProducts();
  const { subscribe } = useWebSocket();
  const queryClient = useQueryClient();

  const columns: ColumnDef<ProductType>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Button variant="link" className="h-auto p-0 text-left" onClick={() => { setSelected({ id: row.original.id || -1, version: row.original.version || 0 }); openModal(DialogMode.EDIT, { title: "Edit Product", description: "Update this product and its variants.", action: "Save changes" }); }}>{row.original.name}</Button>
      ),
    },
    {
      accessorKey: "variants",
      header: "Variants",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <details><summary className="cursor-pointer">{row.original.variants.length} {row.original.variants.length === 1 ? "variant" : "variants"}</summary>
            <ul className="min-w-64 space-y-2 py-2 text-sm">{row.original.variants.map((variant) => <li key={variant.id ?? variant.sku}><p className="font-medium">{variant.name} - {variant.sku}</p><p className="text-xs text-muted-foreground">{variant.price} PHP / {variant.unit}</p></li>)}</ul>
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
            variant="outline"
            size="sm"
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
            <Edit className="h-3 w-3" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelected({
                id: row.original.id || -1,
                version: row.original.version || 0,
              });

              openModal(DialogMode.DELETE, {
                title: "Delete Product",
                description: "Delete this product.",
                action: "Delete",
              });
            }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
        </div>
      ),
    },
  ];

  const [search, setSearch] = useState<string>("");

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

  return (
    <section>
      <Card>
        <CardHeader className="max-sm:flex max-sm:flex-col max-sm:items-start max-sm:gap-2">
          <CardTitle className="leading-none">Products</CardTitle>
          <CardDescription>
            Search by product, variant name, or SKU. Expand variants to review pricing and units.
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="cursor-pointer"
                onClick={() => {
                  openModal(DialogMode.INSERT, {
                    title: "Add Product",
                    description: "Create a new product.",
                    action: "Add Product",
                  });
                }}
              >
                <Plus className="h-3 w-3" />
                <span>Add Product</span>
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-center gap-3 px-4">
            <Input
              className="h-7 w-44 md:w-52"
              placeholder="Search products or variants..."
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                setSearch(value);
                debouncedSearch(value);
              }}
            />
            <Select items={[{ value: "all", label: "All products" }, { value: "with", label: "With variants" }, { value: "without", label: "Without variants" }]} value={variantFilter} onValueChange={(value) => { if (value) { setVariantFilter(value); setPage((page) => ({ ...page, pageIndex: 0 })); } }}>
              <SelectTrigger aria-label="Filter products by variants" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All products</SelectItem><SelectItem value="with">With variants</SelectItem><SelectItem value="without">Without variants</SelectItem></SelectContent>
            </Select>
            <Button type="button" variant="ghost" onClick={() => { debouncedSearch.cancel(); setSearch(""); setSearchQuery(""); setVariantFilter("all"); setPage((page) => ({ ...page, pageIndex: 0 })); }}>Clear filters</Button>
          </div>
          <div className="overflow-hidden">
            <QueryFeedback query={query} label="products" />
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
                {query.isPending ? (
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
                          {query.isError ? "Records unavailable. Use Retry above." : "No matching records. Try adjusting your filters."}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center gap-3 px-4">
              <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
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
              <div className="flex w-full items-center gap-8 lg:w-fit mt-5">
                <PaginationProduct table={table} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
