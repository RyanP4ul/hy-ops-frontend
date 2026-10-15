import { useModal } from "@/components/providers/modal-provider";
import { InventoryTableSchemaType } from "@/schema/inventory";
import {
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDownUp, Edit, Loader2Icon, Plus, Trash2 } from "lucide-react";
import { useInventory } from "../provider";
import { useMemo, useState } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "@/components/ui/table";
import { DialogMode } from "@/types/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import PaginationInventory from "./pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Filter from "./filter";

export function DataTable() {
  const { openModal } = useModal();
  const {
    inventoryQuery,
    pageIndex,
    pageSize,
    setPagination,
    setInventoryDetail,
  } = useInventory();

  const columns: ColumnDef<InventoryTableSchemaType>[] = [
    {
      accessorKey: "sku",
      header: "SKU",
    },
    {
      accessorKey: "description",
      header: "Description",
    },
    {
      accessorKey: "warehouse_name",
      header: "Warehouse Name",
      cell: ({ row }) => {
        const warehouseName = row.original.warehouse_name;
        return (
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  className="font-medium text-blue-700 border-b border-blue-700 hover:text-blue-900 hover:border-blue-900"
                  href="#"
                >
                  {warehouseName}
                </a>
              }
            />
            <TooltipContent side="right">
              <p>Add to library</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "On Hand",
      cell: ({ row }) => {
        const quantity = row.original.quantity;
        let className = "";

        if (quantity <= 0) {
          className = "bg-red-100 text-red-800 border-red-200 hover:bg-red-100";
        } else if (quantity <= 10) {
          className =
            "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100";
        } else {
          className =
            "bg-green-100 text-green-800 border-green-200 hover:bg-green-100";
        }
        return (
          <Badge variant="outline" className={cn(className)}>
            {quantity}
          </Badge>
        );
      },
    },
    {
      accessorKey: "reserved",
      header: "Reserved",
      cell: ({ row }) => {
        const reserved = row.original.reserved;
        let className = "";

        if (reserved <= 0) {
          className =
            "bg-green-100 text-green-800 border-green-200 hover:bg-green-100";
        } else if (reserved <= 10) {
          className =
            "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100";
        } else {
          className = "bg-red-100 text-red-800 border-red-200 hover:bg-red-100";
        }

        return (
          <Badge variant="outline" className={cn(className)}>
            {reserved}
          </Badge>
        );
      },
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" className="cursor-pointer">
            <ArrowDownUp className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              openModal(DialogMode.EDIT, {
                title: "Edit Inventory",
                description: "Edit the inventory details below.",
                action: "Save Changes",
              });

              setInventoryDetail({
                id: row.original.id,
                version: row.original.version,
              });
            }}
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive cursor-pointer"
            onClick={() => {
              // console.log("Delete action for product:", row.original.id);
              openModal(DialogMode.DELETE, {
                title: "Delete Inventory",
                description: "Are you sure you want to delete this inventory?",
                action: "Delete",
              });

              setInventoryDetail({
                id: row.original.id,
                version: row.original.version,
              });
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  const pagination = useMemo(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize],
  );

  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data: inventoryQuery.data?.rows ?? [],
    columns,
    pageCount: Math.ceil((inventoryQuery.data?.total ?? 0) / pageSize),
    state: {
      pagination,
      expanded,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: true,
  });

  return (
    <>
      <div className="px-4">
        <Filter />

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
              {inventoryQuery.isFetching ? (
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
          <PaginationInventory table={table} />
        </div>
      </div>
    </>
  );
}
