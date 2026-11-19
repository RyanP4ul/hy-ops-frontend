"use client";

import { useId } from "react";
import {
  RotateCcw,
  Search,
  SlidersHorizontal,
  Truck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCalendar, type DeliveryStatusFilter } from "../provider";
import {
  CALENDAR_CATEGORIES,
  CATEGORY_LABELS,
  DELIVERY_STATUS_STYLES,
  MANUAL_CATEGORY_STYLES,
} from "./styles";

const STATUS_OPTIONS: { value: DeliveryStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "overdue", label: "Overdue" },
  { value: "in_transit", label: "In transit" },
  { value: "returning", label: "Returning" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function Filters() {
  const {
    statusFilter,
    setStatusFilter,
    warehouseFilter,
    setWarehouseFilter,
    warehouses,
    searchQuery,
    setSearchQuery,
    hideCancelled,
    setHideCancelled,
    deliveriesOnly,
    setDeliveriesOnly,
    selectedCategories,
    setSelectedCategories,
    hasActiveFilters,
    resetFilters,
    periodSummary,
  } = useCalendar();

  const searchId = useId();
  const statusId = useId();
  const warehouseId = useId();
  const hideCancelledId = useId();

  const selectedStatusOption =
    STATUS_OPTIONS.find((option) => option.value === statusFilter) ??
    STATUS_OPTIONS[0];
  const selectedWarehouseName =
    warehouseFilter === "all"
      ? "All warehouses"
      : (warehouses.find((w) => String(w.id) === warehouseFilter)?.name ??
        "All warehouses");

  const extraFilterCount =
    (hideCancelled ? 1 : 0) +
    (!deliveriesOnly && selectedCategories.length > 0 ? 1 : 0);

  function toggleCategory(category: CalendarCategory) {
    setSelectedCategories((current) => {
      const next = current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category];
      return next.length === CALENDAR_CATEGORIES.length ? [] : next;
    });
  }

  return (
    <div className="space-y-2.5 rounded-xl border bg-card p-3">
      {/* Single clean toolbar row */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative min-w-0 flex-1">
          <Label htmlFor={searchId} className="sr-only">
            Search deliveries, drivers, plates, orders, or calendar notes
          </Label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search driver, vehicle plate, order #, recipient, or note..."
            className="h-9 pl-9 pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search query"
              className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Controls group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Delivery status select */}
          <div className="min-w-40">
            <Label htmlFor={statusId} className="sr-only">
              Filter by delivery status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter((value as DeliveryStatusFilter) ?? "all")
              }
            >
              <SelectTrigger id={statusId} className="h-9 w-full min-w-40">
                <SelectValue>
                  <span className="inline-flex items-center gap-2">
                    {statusFilter !== "all" && (
                      <span
                        className={`size-2 shrink-0 rounded-full ${DELIVERY_STATUS_STYLES[statusFilter].dot}`}
                        aria-hidden="true"
                      />
                    )}
                    <span>{selectedStatusOption.label}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => {
                  const count =
                    option.value === "all"
                      ? null
                      : periodSummary.byStatus[option.value];
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2">
                          {option.value !== "all" ? (
                            <span
                              className={`size-2 shrink-0 rounded-full ${DELIVERY_STATUS_STYLES[option.value].dot}`}
                              aria-hidden="true"
                            />
                          ) : (
                            <span className="size-2 shrink-0" aria-hidden="true" />
                          )}
                          <span>{option.label}</span>
                        </span>
                        {count !== null && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {count}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Warehouse select (only when user has access to multiple warehouses) */}
          {warehouses.length > 1 && (
            <div className="min-w-44">
              <Label htmlFor={warehouseId} className="sr-only">
                Filter by warehouse
              </Label>
              <Select
                value={warehouseFilter}
                onValueChange={(value) => setWarehouseFilter(value ?? "all")}
              >
                <SelectTrigger id={warehouseId} className="h-9 w-full min-w-44">
                  <SelectValue>{selectedWarehouseName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All warehouses</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Clean scope toggle: All vs Deliveries only */}
          <div
            role="group"
            aria-label="Calendar item scope"
            className="inline-flex h-9 items-center rounded-lg border bg-muted/40 p-0.5"
          >
            <button
              type="button"
              aria-pressed={!deliveriesOnly}
              onClick={() => setDeliveriesOnly(false)}
              className={`h-8 rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${
                !deliveriesOnly
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All items
            </button>
            <button
              type="button"
              aria-pressed={deliveriesOnly}
              onClick={() => setDeliveriesOnly(true)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${
                deliveriesOnly
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Truck className="size-3.5" aria-hidden="true" />
              Deliveries only
            </button>
          </div>

          {/* More options popover (Hide cancelled + Event categories) */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-1.5 px-3 text-xs"
                >
                  <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                  <span>More filters</span>
                  {extraFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[10px]"
                    >
                      {extraFilterCount}
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent align="end" className="w-80 space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label
                    htmlFor={hideCancelledId}
                    className="cursor-pointer text-sm font-medium"
                  >
                    Hide cancelled runs
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Remove cancelled deliveries from the calendar grid.
                  </p>
                </div>
                <Switch
                  id={hideCancelledId}
                  checked={hideCancelled}
                  onCheckedChange={setHideCancelled}
                />
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Manual event categories
                  </span>
                  {selectedCategories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategories([])}
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Show all
                    </button>
                  )}
                </div>

                {deliveriesOnly ? (
                  <p className="text-xs text-muted-foreground">
                    Switch to &ldquo;All items&rdquo; to filter manual calendar
                    notes by category.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        selectedCategories.length === 0 ? "default" : "outline"
                      }
                      className="h-7 rounded-full px-2.5 text-xs"
                      aria-pressed={selectedCategories.length === 0}
                      onClick={() => setSelectedCategories([])}
                    >
                      All categories
                    </Button>
                    {CALENDAR_CATEGORIES.map((category) => {
                      const isSelected = selectedCategories.includes(category);
                      return (
                        <Button
                          key={category}
                          type="button"
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          className="h-7 rounded-full px-2.5 text-xs"
                          aria-pressed={isSelected}
                          onClick={() => toggleCategory(category)}
                        >
                          <span
                            className={`mr-1.5 size-2 rounded-full ${MANUAL_CATEGORY_STYLES[category].dot}`}
                            aria-hidden="true"
                          />
                          {CATEGORY_LABELS[category]}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Active filter summary chips (only rendered when filters are active) */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 border-t pt-2.5 text-xs">
          <span className="mr-1 text-muted-foreground">Active filters:</span>

          {statusFilter !== "all" && (
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-0.5 font-medium transition hover:bg-muted"
            >
              <span
                className={`size-1.5 rounded-full ${DELIVERY_STATUS_STYLES[statusFilter].dot}`}
                aria-hidden="true"
              />
              Status: {selectedStatusOption.label}
              <X className="size-3 text-muted-foreground" aria-hidden="true" />
            </button>
          )}

          {warehouseFilter !== "all" && (
            <button
              type="button"
              onClick={() => setWarehouseFilter("all")}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-0.5 font-medium transition hover:bg-muted"
            >
              Warehouse: {selectedWarehouseName}
              <X className="size-3 text-muted-foreground" aria-hidden="true" />
            </button>
          )}

          {deliveriesOnly && (
            <button
              type="button"
              onClick={() => setDeliveriesOnly(false)}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-0.5 font-medium transition hover:bg-muted"
            >
              Deliveries only
              <X className="size-3 text-muted-foreground" aria-hidden="true" />
            </button>
          )}

          {hideCancelled && (
            <button
              type="button"
              onClick={() => setHideCancelled(false)}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-0.5 font-medium transition hover:bg-muted"
            >
              Cancelled hidden
              <X className="size-3 text-muted-foreground" aria-hidden="true" />
            </button>
          )}

          {!deliveriesOnly && selectedCategories.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-0.5 font-medium transition hover:bg-muted"
            >
              Categories:{" "}
              {selectedCategories
                .map((category) => CATEGORY_LABELS[category])
                .join(", ")}
              <X className="size-3 text-muted-foreground" aria-hidden="true" />
            </button>
          )}

          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-0.5 font-medium transition hover:bg-muted"
            >
              Search: &ldquo;{searchQuery.trim()}&rdquo;
              <X className="size-3 text-muted-foreground" aria-hidden="true" />
            </button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={resetFilters}
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
