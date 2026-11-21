"use client";

import { useId, useMemo, useState } from "react";
import { Calendar as CalendarIcon, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { manilaCalendarNow, toDateInputValue } from "@/utils/date-util";
import {
  formatPaymentDateRange,
  getActivePaymentFilterChips,
  getPaymentDatePresets,
  hasActivePaymentFilters,
  parseYmdToLocalDate,
  PAYMENT_ENTRY_TYPE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  type ActivePaymentFilterChip,
  type PaymentEntryTypeFilter,
  type PaymentFilters,
  type PaymentMethodFilter,
  type PaymentStatusFilter,
} from "../filters";

type PaymentFiltersBarProps = {
  searchInput: string;
  search: string;
  filters: PaymentFilters;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onUpdateFilters: (patch: Partial<PaymentFilters>) => void;
  onResetAll: () => void;
};

const activeTriggerClass =
  "border-primary/40 bg-primary/5 font-medium text-foreground dark:bg-primary/10";

const filterLabelClass = "text-xs font-medium text-muted-foreground";

export function PaymentFiltersBar({
  searchInput,
  search,
  filters,
  onSearchChange,
  onClearSearch,
  onUpdateFilters,
  onResetAll,
}: PaymentFiltersBarProps) {
  const [dateOpen, setDateOpen] = useState(false);
  const baseId = useId();

  const statusLabelId = `${baseId}-status-label`;
  const statusValueId = `${baseId}-status-value`;
  const methodLabelId = `${baseId}-method-label`;
  const methodValueId = `${baseId}-method-value`;
  const typeLabelId = `${baseId}-type-label`;
  const typeValueId = `${baseId}-type-value`;
  const dateLabelId = `${baseId}-date-label`;
  const dateValueId = `${baseId}-date-value`;

  const manilaToday = useMemo(() => manilaCalendarNow(), []);
  const datePresets = useMemo(() => getPaymentDatePresets(), []);

  const hasDateFilter = Boolean(filters.dateFrom || filters.dateTo);
  const dateLabel = formatPaymentDateRange(filters.dateFrom, filters.dateTo, datePresets);
  const activePresetId = datePresets.find(
    (preset) => preset.from === filters.dateFrom && preset.to === filters.dateTo,
  )?.id;

  const selectedRange = useMemo(() => {
    const from = parseYmdToLocalDate(filters.dateFrom);
    const to = parseYmdToLocalDate(filters.dateTo);
    if (!from && !to) return undefined;
    return { from, to };
  }, [filters.dateFrom, filters.dateTo]);

  const activeChips = useMemo(
    () => getActivePaymentFilterChips(filters, search, datePresets),
    [filters, search, datePresets],
  );
  const canReset = hasActivePaymentFilters(filters, searchInput) || Boolean(search.trim());

  function removeChip(chip: ActivePaymentFilterChip) {
    switch (chip.id) {
      case "search":
        onClearSearch();
        break;
      case "status":
        onUpdateFilters({ paymentStatus: "ALL" });
        break;
      case "method":
        onUpdateFilters({ paymentMethod: "ALL" });
        break;
      case "entryType":
        onUpdateFilters({ entryType: "ALL" });
        break;
      case "date":
        onUpdateFilters({ dateFrom: "", dateTo: "" });
        break;
    }
  }

  return (
    <search
      aria-label="Filter payments"
      className="block space-y-3 border-b bg-muted/20 p-4 md:px-5"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:min-w-72 lg:flex-1 lg:max-w-md">
          <label htmlFor="payment-search" className={filterLabelClass}>
            Search
          </label>
          <InputGroup className="h-10 w-full bg-background">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id="payment-search"
              type="search"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="Customer, order, payment #, or reference…"
              value={searchInput}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            {searchInput && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={onClearSearch}
                >
                  <X aria-hidden="true" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={statusLabelId} className={filterLabelClass}>
            Payment status
          </span>
          <Select
            items={PAYMENT_STATUS_OPTIONS}
            value={filters.paymentStatus}
            onValueChange={(value) => {
              if (value) {
                onUpdateFilters({ paymentStatus: value as PaymentStatusFilter });
              }
            }}
          >
            <SelectTrigger
              aria-labelledby={`${statusLabelId} ${statusValueId}`}
              className={cn(
                "h-10 w-full bg-background data-[size=default]:h-10 lg:w-44",
                filters.paymentStatus !== "ALL" && activeTriggerClass,
              )}
            >
              <SelectValue id={statusValueId} />
            </SelectTrigger>
            <SelectContent align="start">
              {PAYMENT_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={methodLabelId} className={filterLabelClass}>
            Method
          </span>
          <Select
            items={PAYMENT_METHOD_OPTIONS}
            value={filters.paymentMethod}
            onValueChange={(value) => {
              if (value) {
                onUpdateFilters({ paymentMethod: value as PaymentMethodFilter });
              }
            }}
          >
            <SelectTrigger
              aria-labelledby={`${methodLabelId} ${methodValueId}`}
              className={cn(
                "h-10 w-full bg-background data-[size=default]:h-10 lg:w-40",
                filters.paymentMethod !== "ALL" && activeTriggerClass,
              )}
            >
              <SelectValue id={methodValueId} />
            </SelectTrigger>
            <SelectContent align="start">
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={typeLabelId} className={filterLabelClass}>
            Record type
          </span>
          <Select
            items={PAYMENT_ENTRY_TYPE_OPTIONS}
            value={filters.entryType}
            onValueChange={(value) => {
              if (value) {
                onUpdateFilters({ entryType: value as PaymentEntryTypeFilter });
              }
            }}
          >
            <SelectTrigger
              aria-labelledby={`${typeLabelId} ${typeValueId}`}
              className={cn(
                "h-10 w-full bg-background data-[size=default]:h-10 lg:w-44",
                filters.entryType !== "ALL" && activeTriggerClass,
              )}
            >
              <SelectValue id={typeValueId} />
            </SelectTrigger>
            <SelectContent align="start">
              {PAYMENT_ENTRY_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={dateLabelId} className={filterLabelClass}>
            Received date
          </span>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  aria-labelledby={`${dateLabelId} ${dateValueId}`}
                  className={cn(
                    "h-10 w-full justify-start gap-2 bg-background font-normal lg:w-auto lg:min-w-44",
                    hasDateFilter && activeTriggerClass,
                  )}
                >
                  <CalendarIcon
                    className={cn(
                      "size-4 shrink-0",
                      hasDateFilter ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  <span id={dateValueId} className="truncate">
                    {hasDateFilter ? dateLabel : "Any date"}
                  </span>
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex flex-col sm:flex-row">
                <div
                  role="group"
                  aria-label="Quick date presets"
                  className="flex flex-wrap gap-1 border-b p-2 sm:w-36 sm:flex-col sm:border-r sm:border-b-0"
                >
                  {datePresets.map((preset) => {
                    const selected = activePresetId === preset.id;
                    return (
                      <Button
                        key={preset.id}
                        type="button"
                        variant={selected ? "secondary" : "ghost"}
                        size="sm"
                        aria-pressed={selected}
                        className="justify-start font-normal"
                        onClick={() => {
                          onUpdateFilters({ dateFrom: preset.from, dateTo: preset.to });
                          setDateOpen(false);
                        }}
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                  {hasDateFilter && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-start text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        onUpdateFilters({ dateFrom: "", dateTo: "" });
                        setDateOpen(false);
                      }}
                    >
                      All dates
                    </Button>
                  )}
                </div>

                <div className="flex flex-col">
                  <Calendar
                    mode="range"
                    captionLayout="dropdown"
                    numberOfMonths={1}
                    defaultMonth={selectedRange?.from ?? manilaToday}
                    today={manilaToday}
                    disabled={{ after: manilaToday }}
                    selected={selectedRange}
                    onSelect={(range) => {
                      onUpdateFilters({
                        dateFrom: range?.from ? toDateInputValue(range.from) : "",
                        dateTo: range?.to ? toDateInputValue(range.to) : "",
                      });
                    }}
                  />
                  <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
                    <span className="text-muted-foreground">
                      {hasDateFilter ? dateLabel : "Select start and end dates"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {hasDateFilter && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => onUpdateFilters({ dateFrom: "", dateTo: "" })}
                        >
                          Clear
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => setDateOpen(false)}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {canReset && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 gap-1.5 justify-self-start text-muted-foreground hover:text-foreground sm:col-span-2 lg:col-span-1"
            onClick={onResetAll}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset filters
          </Button>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            Active filters ({activeChips.length}):
          </span>
          <ul className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <li key={chip.id} className="max-w-full">
                <span className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background py-0.5 pr-1 pl-2.5 text-xs font-medium text-foreground shadow-2xs">
                  <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                    {chip.category}:
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap",
                      chip.id === "search" && "min-w-0 max-w-44 truncate",
                    )}
                  >
                    {chip.value}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${chip.category}: ${chip.value} filter`}
                    onClick={() => removeChip(chip)}
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </search>
  );
}
