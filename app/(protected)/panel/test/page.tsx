"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPaginationRange } from "@/utils/pagination";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ColumnDef,
  PaginationState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Loader2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";

export type Post = {
  userId: number;
  id: number;
  title: string;
  body: string;
};

export default function Page() {
  const columns = useMemo<ColumnDef<Post>[]>(
    () => [
      {
        accessorKey: "id",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              Id
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
      },
      {
        accessorKey: "userId",
        header: "User Id",
      },
      {
        accessorKey: "title",
        header: "Title",
      },
      {
        accessorKey: "body",
        header: "Body",
      },
    ],
    [],
  );

  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data, isFetching, error } = useQuery({
    queryKey: ["posts", pageIndex, pageSize],

    queryFn: async () => {
      const offset = Math.max(pageIndex * pageSize, 0);
      const response = await fetch(
        `https://jsonplaceholder.typicode.com/posts?_start=${offset}&_limit=${pageSize}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }

      return {
        rows: (await response.json()) as Post[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },

    placeholderData: keepPreviousData,

    staleTime: 1000 * 60 * 5,
  });

  const pagination = useMemo(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize],
  );

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    pageCount: Math.ceil((data?.total ?? 0) / pageSize),
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  const pageNumbers = getPaginationRange(pageIndex, table.getPageCount());

  return (
    <>
      <div className="rounded-md border">
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
            {isFetching ? (
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
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationLink
                  aria-label="Go to first page"
                  size="default"
                  className={`gap-1 px-2.5 sm:pl-2.5 ${
                    !table.getCanPreviousPage()
                      ? "cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                  onClick={() => table.setPageIndex(0)}
                >
                  <span className="hidden sm:block">First</span>
                </PaginationLink>
              </PaginationItem>

              <PaginationItem>
                <PaginationPrevious
                  onClick={() => table.previousPage()}
                  className={
                    !table.getCanPreviousPage()
                      ? "cursor-not-allowed"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>

              {pageNumbers.map((page, index) =>
                page === "..." ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={index}>
                    <PaginationLink
                      onClick={() => table.setPageIndex(page)}
                      href="#"
                      isActive={page === pageIndex}
                    >
                      {page + 1}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() => table.nextPage()}
                  className={
                    !table.getCanNextPage()
                      ? "cursor-not-allowed"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>

              <PaginationItem>
                <PaginationLink
                  aria-label="Go to first page"
                  size="default"
                  className={`gap-1 px-2.5 sm:pl-2.5 ${
                    !table.getCanNextPage()
                      ? "cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                >
                  <span className="hidden sm:block">Last</span>
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </>
  );
}
