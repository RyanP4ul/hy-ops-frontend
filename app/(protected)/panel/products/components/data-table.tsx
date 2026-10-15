"use client";

import { useState, useMemo } from "react";
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

export default function DataTable() {
  const { openModal } = useModal();
  const { query, page, setPage, setSelected, setSearchQuery } = useProducts();

  const columns: ColumnDef<ProductType>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">{row.original.name}</div>
      ),
    },
    {
      accessorKey: "variants",
      header: "Variants",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <Badge variant="outline">
            {row.original.variants.length ?? 0} Variant
          </Badge>
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
            <Edit className="h-3 w-3" />
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
            <Trash2 className="h-3 w-3" />
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

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchQuery(value);
      }, 500),
    [],
  );

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none">Products</CardTitle>
          <CardDescription>
            Manage your products and their variants. Click on a product to view
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
          <div className="flex items-center justify-between px-4">
            <Input
              className="h-7 w-44 md:w-52"
              placeholder="Search deals..."
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                setSearch(value);
                debouncedSearch(value);
              }}
            />
          </div>
          <div className="overflow-hidden">
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
                {query.isFetching ? (
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
                      table.getRowModel().rows.map((row: any) => (
                        <>
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell: any) => (
                              <TableCell key={cell.id}>
                                {cell.column.columnDef.cell
                                  ? (cell.column.columnDef.cell as any)(
                                      cell.getContext(),
                                    )
                                  : cell.getValue()}
                              </TableCell>
                            ))}
                          </TableRow>
                        </>
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
            <div className="flex items-center justify-between px-4">
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
