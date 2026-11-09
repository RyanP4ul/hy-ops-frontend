"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ManagementSearch } from "@/components/management-list";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { debounce } from "@/utils/debounce";
import { useInventory } from "../provider";

const stockOptions = [
  { value: "All", label: "All stock levels" },
  { value: "High", label: "High stock" },
  { value: "Low", label: "Low stock" },
  { value: "Out", label: "Out of stock" },
];

export default function Filter() {
  const {
    warehouseQuery, setPagination, searchQuery, setSearchQuery, stockStatus, setStockStatus,
    warehouseId, setWarehouseId, dateRange, setDateRange,
  } = useInventory();
  const [search, setSearch] = useState(searchQuery);
  const [previousQuery, setPreviousQuery] = useState(searchQuery);

  if (searchQuery !== previousQuery) {
    setPreviousQuery(searchQuery);
    setSearch(searchQuery);
  }

  const debouncedSearch = useMemo(() => debounce((value: string) => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
    setSearchQuery(value);
  }, 350), [setSearchQuery, setPagination]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  function clearSearch() {
    debouncedSearch.cancel();
    setSearch("");
    setSearchQuery("");
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  function resetFilters() {
    clearSearch();
    setStockStatus("All");
    setWarehouseId(null);
    setDateRange(undefined);
  }

  const filtered = Boolean(search || searchQuery || stockStatus !== "All" || warehouseId || dateRange?.from || dateRange?.to);
  const selectedWarehouse = warehouseQuery.data?.rows.find((warehouse) => warehouse.id === warehouseId);

  return (
    <div className="space-y-3 border-b bg-muted/20 p-4 md:px-5">
      <ManagementSearch id="inventory-search" value={search} placeholder="Search SKU or product name…" onChange={(value) => { setSearch(value); debouncedSearch(value); }} onClear={clearSearch} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full space-y-1.5 sm:w-auto">
          <label htmlFor="stock-status" className="text-xs font-medium text-muted-foreground">Stock level</label>
          <Select items={stockOptions} value={stockStatus} onValueChange={(value) => {
            if (value === "All" || value === "High" || value === "Low" || value === "Out") {
              setStockStatus(value);
              setPagination((current) => ({ ...current, pageIndex: 0 }));
            }
          }}>
            <SelectTrigger id="stock-status" className="h-10 w-full bg-background sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{stockOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1.5 sm:w-auto">
          <label htmlFor="inventory-warehouse" className="text-xs font-medium text-muted-foreground">Warehouse</label>
          <Select value={warehouseId === null ? "All" : String(warehouseId)} disabled={warehouseQuery.isPending || warehouseQuery.isError} onValueChange={(value) => {
            setWarehouseId(value && value !== "All" ? Number(value) : null);
            setPagination((current) => ({ ...current, pageIndex: 0 }));
          }}>
            <SelectTrigger id="inventory-warehouse" className="h-10 w-full bg-background sm:w-52">
              <SelectValue>{warehouseQuery.isPending ? "Loading warehouses…" : warehouseQuery.isError ? "Warehouses unavailable" : selectedWarehouse?.name ?? (warehouseId === null ? "All warehouses" : `Warehouse #${warehouseId}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All warehouses</SelectItem>
              {warehouseQuery.data?.rows.map((warehouse) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1.5 sm:w-auto">
          <p id="inventory-date-label" className="text-xs font-medium text-muted-foreground">Date range</p>
          <Popover>
            <PopoverTrigger render={<Button variant="outline" aria-labelledby="inventory-date-label inventory-date-value" className="h-10 w-full justify-start bg-background font-normal sm:w-auto">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
              <span id="inventory-date-value">{dateRange?.from ? `${format(dateRange.from, "MMM d, yyyy")}${dateRange.to ? ` – ${format(dateRange.to, "MMM d, yyyy")}` : " – Select end date"}` : "All dates"}</span>
            </Button>} />
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={(range) => { setDateRange(range); setPagination((current) => ({ ...current, pageIndex: 0 })); }} numberOfMonths={1} />
            </PopoverContent>
          </Popover>
        </div>
        {filtered && <Button variant="ghost" size="sm" className="h-10" onClick={resetFilters}>Reset filters</Button>}
      </div>
      {warehouseQuery.isError && <p role="alert" className="text-xs text-destructive">Warehouse filters could not be loaded. <button type="button" className="underline" onClick={() => void warehouseQuery.refetch()}>Retry</button></p>}
    </div>
  );
}
