"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Loader2,
  MapPin,
  Plus,
  Route,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { PaginatedCombobox } from "@/components/paginated-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "../lib/api";
import type {
  Action,
  Booking,
  City,
  MultiStopQuotation,
  PickupWarehouse,
  ReadyOrder,
} from "../types";
import { ServicePanel } from "./order-panels";
import {
  EmptyBlock,
  money,
  primaryCtaClass,
  QueryError,
  RowsSkeleton,
  warehouseAddress,
  words,
} from "./shared";

const MAX_DROPOFF_STOPS = 19;

export function MultiStopBuilder({
  enabled,
  busy,
  readyOrders,
  readyPending,
  readyError,
  retryReady,
  cities,
  citiesLoading,
  citiesError,
  retryCities,
  action,
  onBooked,
}: {
  enabled: boolean;
  busy: boolean;
  readyOrders: ReadyOrder[];
  readyPending: boolean;
  readyError?: string;
  retryReady: () => void;
  cities: City[];
  citiesLoading: boolean;
  citiesError?: string;
  retryCities: () => void;
  action: Action;
  onBooked: (bookingId: number) => void;
}) {
  const client = useQueryClient();
  const optimizeHelpId = useId();
  const optimizeInputId = useId();
  const searchInputId = useId();
  const confirmPackageId = useId();

  const [warehousePage, setWarehousePage] = useState(0);
  const [warehouseSearch, setWarehouseSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] =
    useState<PickupWarehouse | null>(null);

  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | "lalamove" | "switch">(
    "all",
  );
  const [switchingMethod, setSwitchingMethod] = useState(false);

  const [city, setCity] = useState("");
  const [service, setService] = useState("");
  const [isRouteOptimized, setIsRouteOptimized] = useState(false);
  const [quote, setQuote] = useState<MultiStopQuotation | null>(null);
  const [packageConfirmed, setPackageConfirmed] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  const confirmation = useRef<{ quote: string; key: string } | null>(null);
  const quotePanelRef = useRef<HTMLElement>(null);

  const warehousesQuery = useQuery({
    queryKey: ["lalamove", "warehouses", warehousePage, warehouseSearch],
    queryFn: () =>
      api<{ rows: PickupWarehouse[]; total: number }>(
        "GET",
        `/warehouses?page=${warehousePage}&search=${encodeURIComponent(warehouseSearch)}`,
      ),
  });

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-select the first available warehouse when none is chosen yet.
  const activeWarehouse = useMemo(() => {
    if (selectedWarehouse) return selectedWarehouse;
    const rows = warehousesQuery.data?.rows ?? [];
    if (!rows.length) return null;
    const firstOrderWarehouseId = selectedOrderIds.length
      ? readyOrders.find((o) => o.id === selectedOrderIds[0])
          ?.lalamove_pickup_warehouse_id ??
        readyOrders.find((o) => o.id === selectedOrderIds[0])?.warehouse_id
      : undefined;
    if (firstOrderWarehouseId) {
      const match = rows.find((w) => w.id === firstOrderWarehouseId);
      if (match) return match;
    }
    return rows[0] ?? null;
  }, [selectedWarehouse, warehousesQuery.data?.rows, selectedOrderIds, readyOrders]);

  const orderById = useMemo(
    () => new Map(readyOrders.map((o) => [o.id, o])),
    [readyOrders],
  );

  // Keep only selected IDs that are still in the ready list.
  const selectedOrders = useMemo(
    () =>
      selectedOrderIds
        .map((id) => orderById.get(id))
        .filter((item): item is ReadyOrder => Boolean(item)),
    [selectedOrderIds, orderById],
  );

  const selectedSet = useMemo(
    () => new Set(selectedOrders.map((o) => o.id)),
    [selectedOrders],
  );

  const needsMethodSwitch = useMemo(
    () => selectedOrders.filter((o) => o.delivery_method !== "LALAMOVE"),
    [selectedOrders],
  );

  const blockedSelected = useMemo(
    () =>
      selectedOrders.filter(
        (o) => o.delivery_method === "LALAMOVE" && !o.ready_for_lalamove,
      ),
    [selectedOrders],
  );

  const matchingReady = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return readyOrders.filter((order) => {
      if (orderFilter === "lalamove" && !order.ready_for_lalamove) return false;
      if (orderFilter === "switch" && order.delivery_method === "LALAMOVE")
        return false;
      if (!q) return true;
      return `${order.order_number} ${order.order_group_number || ""} ${order.shipping_recipient || ""} ${order.customer_name || ""} ${order.customer_company || ""} ${order.shipping_address || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [readyOrders, orderSearch, orderFilter]);

  const services =
    cities.find((item) => item.locode === city)?.services || [];
  const chosenService = services.find((item) => item.key === service);

  const warehouseMissingPhone = !activeWarehouse?.phone_number?.trim();
  const warehouseMissingCoords =
    activeWarehouse?.latitude == null || activeWarehouse?.longitude == null;

  const canQuote =
    enabled &&
    Boolean(activeWarehouse) &&
    !warehouseMissingPhone &&
    !warehouseMissingCoords &&
    selectedOrders.length >= 1 &&
    selectedOrders.length <= MAX_DROPOFF_STOPS &&
    needsMethodSwitch.length === 0 &&
    blockedSelected.length === 0 &&
    Boolean(chosenService);

  const secondsLeft = quote
    ? Math.max(0, Math.ceil((Date.parse(quote.expiresAt) - clock) / 1000))
    : 0;
  const expired = Boolean(quote) && secondsLeft <= 0;

  const stepIndex = quote
    ? 2
    : selectedOrders.length > 0 && activeWarehouse
      ? 1
      : 0;

  function invalidateQuote() {
    setQuote(null);
    setPackageConfirmed(false);
    confirmation.current = null;
  }

  function toggleOrder(orderId: number) {
    invalidateQuote();
    setSelectedOrderIds((current) => {
      if (current.includes(orderId)) {
        return current.filter((id) => id !== orderId);
      }
      if (current.length >= MAX_DROPOFF_STOPS) return current;
      return [...current, orderId];
    });
  }

  function addGroup(groupId: string) {
    invalidateQuote();
    const members = readyOrders
      .filter((o) => o.order_group_id === groupId)
      .sort(
        (a, b) =>
          (a.order_group_position ?? 0) - (b.order_group_position ?? 0) ||
          a.id - b.id,
      );
    setSelectedOrderIds((current) => {
      const next = [...current];
      for (const member of members) {
        if (next.length >= MAX_DROPOFF_STOPS) break;
        if (!next.includes(member.id)) next.push(member.id);
      }
      return next;
    });
  }

  function moveStop(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selectedOrders.length) return;
    invalidateQuote();
    setSelectedOrderIds((current) => {
      const validIds = selectedOrders.map((o) => o.id);
      const next = [...validIds];
      [next[index], next[target]] = [next[target], next[index]];
      return next.filter((id) => current.includes(id));
    });
  }

  async function switchSelectedToLalamove() {
    if (!needsMethodSwitch.length) return;
    setSwitchingMethod(true);
    try {
      await action(async () => {
        await api("PUT", "/orders/method", {
          method: "LALAMOVE",
          orders: needsMethodSwitch.map((o) => ({
            order_id: o.id,
            version: o.version ?? 1,
          })),
        });
        invalidateQuote();
        await client.invalidateQueries({ queryKey: ["lalamove", "eligible"] });
      });
    } finally {
      setSwitchingMethod(false);
    }
  }

  async function requestMultiStopQuote() {
    if (!activeWarehouse || !selectedOrders.length) return;
    setQuoting(true);
    try {
      const ok = await action(async () => {
        invalidateQuote();
        const versions = Object.fromEntries(
          selectedOrders.map((o) => [String(o.id), o.version ?? 1]),
        );
        const result = await api<MultiStopQuotation>(
          "POST",
          "/multi-stop/quotations",
          {
            order_ids: selectedOrders.map((o) => o.id),
            order_versions: versions,
            pickup_warehouse_id: activeWarehouse.id,
            city,
            service_type: service,
            is_route_optimized: isRouteOptimized && selectedOrders.length > 1,
          },
        );
        setQuote(result);
      });
      if (ok) {
        requestAnimationFrame(() => {
          quotePanelRef.current
            ?.querySelector("h2")
            ?.focus({ preventScroll: true });
          if (window.matchMedia("(max-width: 1023px)").matches) {
            quotePanelRef.current?.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
              block: "start",
            });
          }
        });
      }
    } finally {
      setQuoting(false);
    }
  }

  async function confirmMultiStopBooking() {
    if (!activeWarehouse || !quote) return;
    let op = confirmation.current;
    if (op?.quote !== quote.quotation_ref) {
      op = { quote: quote.quotation_ref, key: crypto.randomUUID() };
      confirmation.current = op;
    }
    const key = op.key;
    setBooking(true);
    try {
      let bookedId: number | null = null;
      await action(async () => {
        const quotedIds = quote.route.dropoffs.map((d) => d.order_id);
        const versions = Object.fromEntries(
          quotedIds.map((id) => [
            String(id),
            orderById.get(id)?.version ?? 1,
          ]),
        );
        const created = await api<Booking>("POST", "/multi-stop/orders", {
          order_ids: quotedIds,
          order_versions: versions,
          pickup_warehouse_id: activeWarehouse.id,
          quotation_ref: quote.quotation_ref,
          idempotency_key: key,
          package_confirmed: packageConfirmed,
        });
        bookedId = created.id;
        setQuote(null);
      });
      if (bookedId) onBooked(bookedId);
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <ol
        aria-label="Multi-stop booking progress"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b pb-3.5 text-xs"
      >
        {[
          "1. Pickup & stops",
          "2. Vehicle & route",
          "3. Quotation & confirm",
        ].map((label, idx) => (
          <li
            key={label}
            aria-current={stepIndex === idx ? "step" : undefined}
            className={cn(
              "flex items-center gap-2",
              idx === stepIndex
                ? "font-semibold text-foreground"
                : idx < stepIndex
                  ? "text-foreground/75"
                  : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                idx < stepIndex
                  ? "bg-emerald-500"
                  : idx === stepIndex
                    ? "bg-orange-600"
                    : "bg-border",
              )}
            />
            {label}
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-5">
          {/* 1. Pickup Warehouse */}
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
              <h2 className="text-sm font-semibold tracking-tight">
                Pickup warehouse
              </h2>
              <Link
                href="/panel/warehouses"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Manage warehouses
              </Link>
            </div>
            <div className="space-y-3.5 p-5">
              <PaginatedCombobox<PickupWarehouse>
                id="multi-stop-pickup-warehouse"
                label="Pickup location"
                value={activeWarehouse ? String(activeWarehouse.id) : null}
                selectedLabel={activeWarehouse?.name || ""}
                options={warehousesQuery.data?.rows ?? []}
                getOptionValue={(item) => String(item.id)}
                renderOption={(item) => (
                  <div className="min-w-0 py-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {warehouseAddress(item)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.phone_number || "Phone missing"}
                    </p>
                  </div>
                )}
                onValueChange={(_val, option) => {
                  setSelectedWarehouse(option);
                  invalidateQuote();
                }}
                onSearchChange={(q) => {
                  setWarehouseSearch(q);
                  setWarehousePage(0);
                }}
                page={warehousePage}
                totalPages={Math.ceil((warehousesQuery.data?.total || 0) / 10)}
                onPageChange={setWarehousePage}
                isLoading={warehousesQuery.isFetching}
                disabled={busy}
                required
                placeholder="Search pickup warehouse..."
                emptyMessage="No matching warehouses."
              />

              {activeWarehouse && (
                <div className="rounded-lg bg-muted/40 px-3.5 py-2.5 text-xs">
                  <p className="font-medium text-foreground">
                    {activeWarehouse.name}
                  </p>
                  <p className="mt-0.5 break-words text-muted-foreground">
                    {warehouseAddress(activeWarehouse) || "Address missing"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Phone:{" "}
                    <span
                      className={
                        warehouseMissingPhone
                          ? "font-medium text-amber-700 dark:text-amber-300"
                          : "tabular-nums text-foreground"
                      }
                    >
                      {activeWarehouse.phone_number || "Required before quoting"}
                    </span>
                  </p>
                </div>
              )}

              {(warehouseMissingPhone || warehouseMissingCoords) &&
                activeWarehouse && (
                  <p
                    role="status"
                    className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
                  >
                    <AlertTriangle
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Save a valid phone number and verified coordinates for{" "}
                      <strong>{activeWarehouse.name}</strong> in Warehouses
                      first.
                    </span>
                  </p>
                )}
            </div>
          </section>

          {/* 2. Selected Stops Sequence */}
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  Drop-off stops
                </h2>
                <span className="rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {selectedOrders.length} / {MAX_DROPOFF_STOPS}
                </span>
              </div>
              {selectedOrders.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy}
                  onClick={() => {
                    setSelectedOrderIds([]);
                    invalidateQuote();
                  }}
                >
                  Clear stops
                </Button>
              )}
            </div>

            <div className="space-y-4 p-5">
              {needsMethodSwitch.length > 0 && (
                <div
                  role="status"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/45 bg-amber-500/[0.09] px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/[0.12] dark:text-amber-200"
                >
                  <span>
                    {needsMethodSwitch.length}{" "}
                    {needsMethodSwitch.length === 1
                      ? "selected order is"
                      : "selected orders are"}{" "}
                    not set to Lalamove delivery yet.
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={busy || switchingMethod}
                    onClick={() => void switchSelectedToLalamove()}
                  >
                    {switchingMethod && (
                      <Loader2
                        className="size-3 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    Switch {needsMethodSwitch.length} to Lalamove
                  </Button>
                </div>
              )}

              {selectedOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  Select orders below to build your multi-stop Lalamove run.
                </div>
              ) : (
                <ol aria-label="Delivery stop order" className="space-y-2.5">
                  {selectedOrders.map((order, idx) => {
                    const isLalamove = order.delivery_method === "LALAMOVE";
                    const hasIssue = isLalamove && !order.ready_for_lalamove;
                    return (
                      <li
                        key={order.id}
                        className={cn(
                          "rounded-xl border bg-background p-3.5",
                          hasIssue && "border-amber-500/50",
                        )}
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-600/10 text-xs font-semibold tabular-nums text-orange-700 dark:text-orange-400">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {order.order_number}
                              </p>
                              {order.order_group_number && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                  Group {order.order_group_number}
                                </span>
                              )}
                              {!isLalamove && (
                                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                                  {words(order.delivery_method || "INTERNAL")}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {order.shipping_recipient ||
                                order.customer_name ||
                                "Recipient missing"}
                              {order.shipping_phone
                                ? ` · ${order.shipping_phone}`
                                : ""}
                            </p>
                            <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                              <MapPin
                                className="mt-0.5 size-3 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="break-words">
                                {order.shipping_address || "Address missing"}
                              </span>
                            </p>
                            {hasIssue && order.blocked_reason && (
                              <p className="mt-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                                {order.blocked_reason}
                              </p>
                            )}
                          </div>

                          <div className="ml-auto flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-8"
                              disabled={busy || idx === 0}
                              aria-label={`Move ${order.order_number} up`}
                              onClick={() => moveStop(idx, -1)}
                            >
                              <ArrowUp className="size-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-8"
                              disabled={busy || idx === selectedOrders.length - 1}
                              aria-label={`Move ${order.order_number} down`}
                              onClick={() => moveStop(idx, 1)}
                            >
                              <ArrowDown
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={busy}
                              aria-label={`Remove ${order.order_number}`}
                              onClick={() => toggleOrder(order.id)}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {selectedOrders.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Stops are visited from top to bottom unless Lalamove route
                  optimization is enabled below.
                </p>
              )}
            </div>
          </section>

          {/* 3. Order Picker */}
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  Add ready orders
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {matchingReady.length} available
                </span>
              </div>

              <div
                role="group"
                aria-label="Filter ready orders"
                className="inline-flex rounded-lg bg-muted p-0.5"
              >
                {(
                  [
                    { value: "all", label: "All" },
                    { value: "lalamove", label: "Lalamove ready" },
                    { value: "switch", label: "Other method" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={orderFilter === item.value}
                    onClick={() => setOrderFilter(item.value)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      orderFilter === item.value
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3.5 p-5">
              <search className="relative">
                <label htmlFor={searchInputId} className="sr-only">
                  Search ready orders
                </label>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={searchInputId}
                  type="search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search order number, group, recipient, or address..."
                  className="h-9 pr-8 pl-8 text-sm"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {orderSearch && (
                  <button
                    type="button"
                    aria-label="Clear order search"
                    onClick={() => setOrderSearch("")}
                    className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </search>

              {readyPending ? (
                <RowsSkeleton rows={3} label="ready orders" />
              ) : readyError ? (
                <QueryError message={readyError} retry={retryReady} />
              ) : matchingReady.length === 0 ? (
                <EmptyBlock
                  title="No matching orders ready for scheduling"
                  description="Orders in Scheduling status without an active fleet or Lalamove run appear here."
                />
              ) : (
                <fieldset className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  <legend className="sr-only">
                    Select orders to include in this multi-stop Lalamove booking
                  </legend>
                  {matchingReady.map((order) => {
                    const checked = selectedSet.has(order.id);
                    const atLimit =
                      !checked && selectedOrders.length >= MAX_DROPOFF_STOPS;
                    const nonMethodBlocked =
                      order.delivery_method === "LALAMOVE" &&
                      !order.ready_for_lalamove;
                    const paymentBlocked =
                      order.payment_arrangement === "PAY_ON_DELIVERY";
                    const checkboxId = `multi-stop-order-${order.id}`;

                    return (
                      <div
                        key={order.id}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-colors",
                          checked
                            ? "border-orange-600/50 bg-orange-500/[0.05]"
                            : "hover:bg-muted/25",
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={checked}
                            disabled={busy || atLimit || paymentBlocked}
                            onChange={() => toggleOrder(order.id)}
                            className="mt-0.5 size-4 shrink-0 accent-orange-600"
                          />
                          <label
                            htmlFor={checkboxId}
                            className="min-w-0 flex-1 cursor-pointer text-xs"
                          >
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {order.order_number}
                              </span>
                              {order.order_group_number && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                  {order.order_group_number} ({order.order_group_position}/{order.order_group_size})
                                </span>
                              )}
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[11px] font-medium",
                                  order.delivery_method === "LALAMOVE"
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {words(order.delivery_method || "INTERNAL")}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-muted-foreground">
                              {order.shipping_recipient ||
                                order.customer_name ||
                                "Recipient missing"}{" "}
                              ·{" "}
                              {order.shipping_address || "Address missing"}
                            </span>
                            {(nonMethodBlocked || paymentBlocked) &&
                              order.blocked_reason && (
                                <span className="mt-1 block text-amber-800 dark:text-amber-300">
                                  {order.blocked_reason}
                                </span>
                              )}
                          </label>
                        </div>

                        {order.order_group_id &&
                          (order.order_group_size ?? 1) > 1 && (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={busy || paymentBlocked}
                              onClick={() => addGroup(order.order_group_id!)}
                            >
                              <Plus className="size-3" aria-hidden="true" />
                              Add group
                            </Button>
                          )}
                      </div>
                    );
                  })}
                </fieldset>
              )}
            </div>
          </section>

          {/* 4. Vehicle & Route Optimization */}
          <ServicePanel
            cities={cities}
            city={city}
            service={service}
            disabled={busy || !enabled}
            loading={citiesLoading}
            error={citiesError}
            onCity={(val) => {
              setCity(val);
              setService("");
              invalidateQuote();
            }}
            onService={(val) => {
              setService(val);
              invalidateQuote();
            }}
            retry={retryCities}
          />

          {selectedOrders.length > 1 && (
            <section className="overflow-hidden rounded-xl border bg-card p-5">
              <div className="flex items-start gap-3">
                <input
                  id={optimizeInputId}
                  type="checkbox"
                  checked={isRouteOptimized}
                  disabled={busy}
                  aria-describedby={optimizeHelpId}
                  onChange={(e) => {
                    setIsRouteOptimized(e.target.checked);
                    invalidateQuote();
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-orange-600"
                />
                <div className="min-w-0 space-y-1 text-xs">
                  <label
                    htmlFor={optimizeInputId}
                    className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-foreground"
                  >
                    <Sparkles
                      className="size-3.5 text-orange-600"
                      aria-hidden="true"
                    />
                    Optimize stop order with Lalamove
                  </label>
                  <p id={optimizeHelpId} className="leading-relaxed text-muted-foreground">
                    Lalamove automatically reorders your {selectedOrders.length}{" "}
                    drop-off stops for the shortest route and lowest fare. Leave
                    unchecked to enforce your exact stop order above.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Sticky Quotation Sidebar */}
        <aside
          ref={quotePanelRef}
          aria-label="Multi-stop quotation"
          className="min-w-0 scroll-mt-4 lg:sticky lg:top-6"
        >
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-2 border-b px-5 py-3.5">
              <h2
                tabIndex={-1}
                className="text-sm font-semibold tracking-tight outline-none"
              >
                Multi-stop quotation
              </h2>
              {quote && (
                <span
                  role="timer"
                  aria-label="Quotation time remaining"
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
                    expired
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {expired
                    ? "Expired"
                    : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
                </span>
              )}
            </div>

            <div className="space-y-4 p-5">
              {!enabled && (
                <p
                  role="status"
                  className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground"
                >
                  New Lalamove bookings are disabled.
                </p>
              )}

              <div className="rounded-lg bg-muted/40 px-3.5 py-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Pickup</span>
                  <span className="truncate font-medium text-foreground">
                    {activeWarehouse?.name || "Not selected"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Drop-off stops</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {selectedOrders.length}{" "}
                    {selectedOrders.length === 1 ? "order" : "orders"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Route order</span>
                  <span className="font-medium text-foreground">
                    {isRouteOptimized && selectedOrders.length > 1
                      ? "Lalamove optimized"
                      : "Manual sequence"}
                  </span>
                </div>
              </div>

              {quote ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {words(quote.serviceType)} · {quote.route.dropoffs.length}{" "}
                      {quote.route.dropoffs.length === 1 ? "stop" : "stops"}
                    </p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                      {money(
                        quote.priceBreakdown.total,
                        quote.priceBreakdown.currency,
                      )}
                    </p>
                  </div>

                  {quote.route_reordered && (
                    <div
                      role="status"
                      className="flex items-start gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-900 dark:text-emerald-200"
                    >
                      <Route
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Lalamove optimized your drop-off sequence below. Review
                        the final order before confirming.
                      </span>
                    </div>
                  )}

                  {/* Quoted stop order preview */}
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-foreground">
                      Confirmed route sequence
                    </p>
                    <ol className="space-y-1.5 text-xs">
                      {quote.route.dropoffs.map((stop, idx) => (
                        <li
                          key={stop.order_id}
                          className="flex items-start gap-2 text-muted-foreground"
                        >
                          <span className="font-semibold tabular-nums text-foreground">
                            {idx + 1}.
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium text-foreground">
                              {stop.order_number}
                            </span>{" "}
                            · {stop.name}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <details className="group border-y py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground">
                      <span>Fee breakdown</span>
                      <ChevronDown
                        className="size-3.5 transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <dl className="mt-2.5 space-y-1.5">
                      {Object.entries(quote.priceBreakdown)
                        .filter(([key]) => !["total", "currency"].includes(key))
                        .map(([key, value]) => (
                          <div
                            key={key}
                            className="flex justify-between gap-4 text-xs"
                          >
                            <dt className="text-muted-foreground">
                              {words(key)}
                            </dt>
                            <dd className="tabular-nums">
                              {money(value, quote.priceBreakdown.currency)}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </details>

                  <div className="flex items-start gap-2.5 rounded-lg border p-3 text-xs">
                    <input
                      id={confirmPackageId}
                      className="mt-0.5 size-4 shrink-0 accent-orange-600"
                      type="checkbox"
                      checked={packageConfirmed}
                      disabled={busy || expired}
                      onChange={(event) =>
                        setPackageConfirmed(event.target.checked)
                      }
                    />
                    <label
                      htmlFor={confirmPackageId}
                      className="cursor-pointer leading-relaxed"
                    >
                      <span className="font-medium text-foreground">
                        All {quote.route.dropoffs.length} orders fit the
                        selected vehicle
                      </span>
                      <span className="block text-muted-foreground">
                        Combined dimensions and weight verified for{" "}
                        {words(quote.serviceType)}.
                      </span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <Button
                      type="button"
                      className={cn("h-10 w-full", primaryCtaClass)}
                      disabled={
                        busy ||
                        expired ||
                        !packageConfirmed ||
                        !enabled ||
                        booking
                      }
                      onClick={() => void confirmMultiStopBooking()}
                    >
                      {booking ? (
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <ArrowRight className="size-4" aria-hidden="true" />
                      )}
                      {booking
                        ? "Confirming..."
                        : `Confirm ${quote.route.dropoffs.length}-stop booking`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={busy || !canQuote || quoting}
                      onClick={() => void requestMultiStopQuote()}
                    >
                      {quoting ? "Getting quote..." : "Refresh quote"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3.5">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {!selectedOrders.length
                      ? "Add at least one ready order, then choose a city and vehicle to check the combined courier fare."
                      : needsMethodSwitch.length > 0
                        ? "Switch all selected orders to Lalamove delivery before requesting a quotation."
                        : blockedSelected.length > 0
                          ? "Fix or remove blocked orders before requesting a quotation."
                          : !chosenService
                            ? "Select an operating city and vehicle service to calculate the multi-stop fare."
                            : `Ready to quote ${selectedOrders.length} ${selectedOrders.length === 1 ? "stop" : "stops"} with ${words(chosenService.key)}.`}
                  </p>
                  <Button
                    type="button"
                    className={cn("h-10 w-full", primaryCtaClass)}
                    disabled={busy || !canQuote || quoting}
                    onClick={() => void requestMultiStopQuote()}
                  >
                    {quoting && (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    {quoting ? "Getting quote..." : "Get multi-stop quote"}
                  </Button>
                </div>
              )}

              <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
                Company pays the single combined courier fee. No booking is
                created until you confirm.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
