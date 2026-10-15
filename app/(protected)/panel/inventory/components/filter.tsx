"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { debounce } from "@/utils/debounce";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useInventory } from "../provider";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";

export default function Filter() {
  const {
    warehouseQuery,
    setSearchQuery,
    setStockStatus,
    warehouseId,
    setWarehouseId,
    dateRange,
    setDateRange,
  } = useInventory();

  const [search, setSearch] = useState<string>("");

  const stock_status_data = [
    { value: "All", label: "All" },
    { value: "High", label: "High" },
    { value: "Low", label: "Low" },
    { value: "Out", label: "Out of Stock" },
  ];

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchQuery(value);
      }, 500),
    [],
  );

  return (
    <div className="flex flex-wrap items-end gap-4 py-6">
      <div className="flex flex-col gap-2">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>

          <InputGroupInput
            placeholder="Search SKU or Product Name..."
            value={search}
            onChange={(event) => {
              const value = event.target.value;

              setSearch(value);
              debouncedSearch(value);
            }}
          />
        </InputGroup>
      </div>

      <div className="flex flex-col gap-2">
        <Select
          defaultValue="All"
          onValueChange={(value) => {
            setStockStatus(value as any);
          }}
        >
          <SelectTrigger id="stock-status" className="w-full sm:w-55">
            <SelectValue placeholder="Filter by stock status" />
          </SelectTrigger>

          <SelectContent>
            <SelectGroup>
              {stock_status_data.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        status.value === "High"
                          ? "bg-green-500"
                          : status.value === "Low"
                            ? "bg-yellow-500"
                            : status.value === "Out"
                              ? "bg-red-500"
                              : "bg-gray-500"
                      }`}
                    />
                    {
                      stock_status_data.find((s) => s.value === status.value)
                        ?.label
                    }
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        {warehouseQuery.isFetched ? (
          <Select
            onValueChange={(value) =>
              setWarehouseId(value ? parseInt(value as string) : null)
            }
          >
            <SelectTrigger id="warehouse" className="w-full sm:w-55">
              <SelectValue placeholder="Filter by warehouse">
                {
                  warehouseQuery.data?.rows?.find(
                    (warehouse) => warehouse.id === warehouseId,
                  )?.name
                }
              </SelectValue>
            </SelectTrigger>

            <SelectContent>
              <SelectGroup>
                <SelectItem value="All">All</SelectItem>

                {warehouseQuery.data?.rows?.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <Select disabled>
            <SelectTrigger className="w-full sm:w-55">
              <SelectValue placeholder="Loading warehouses..." />
            </SelectTrigger>
          </Select>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                id="date-picker-simple"
                className="w-full justify-start font-normal"
              >
                <span className="text-muted-foreground">
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, "PPP")} - ${format(
                        dateRange.to,
                        "PPP",
                      )}`
                    : "Pick a date"}
                </span>
              </Button>
            }
          />

          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              className="rounded-lg border"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
