"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  Info,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { request } from "@/components/http";
import {
  formatOrderLabel,
  getOrderPaymentSummary,
  getOrderStatusBadgeClass,
} from "@/components/order-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { OrderDetail } from "@/schema/order";
import { formatCurrency } from "@/utils/date-util";
import { SavedAddressForm } from "./saved-address-form";

export type EditOrderPayload = {
  version: number;
  notes: string;
  delivery_type?: "INTERNAL" | "LALAMOVE";
  customer_address_id?: number;
  items?: { inventory_id: number; quantity: number }[];
};

type SavedAddressOption = {
  id: number;
  customer_id: number;
  address_line: string;
  barangay: string;
  city_municipality: string;
  province: string;
  postal_code: string | null;
  latitude: string | null;
  longitude: string | null;
};

type CatalogRow = {
  id: number;
  product_name: string | null;
  variant_name?: string | null;
  description: string | null;
  sku: string | null;
  reserved: number;
  quantity: number;
  price: string | number | null;
};

type StockDetailRow = {
  inventory_id: number;
  quantity: number;
  price: string | number;
};

type EditOrderLine = {
  inventory_id: number;
  product_name?: string | null;
  product_variant_name: string;
  product_variant_sku: string;
  quantity: number;
  quantityInput: string;
  price: number | null;
  originalQuantity: number;
};

const DELIVERY_METHOD_OPTIONS = [
  {
    value: "INTERNAL" as const,
    label: "Company delivery",
    description: "Scheduled through your internal fleet and delivery calendar.",
  },
  {
    value: "LALAMOVE" as const,
    label: "Lalamove",
    description: "Booked separately via on-demand Lalamove courier.",
  },
];

function formatAddress(address: SavedAddressOption): string {
  return [
    address.address_line,
    address.barangay,
    address.city_municipality,
    address.province,
    address.postal_code,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

function normalizeDeliveryMethod(
  value?: string | null,
): "INTERNAL" | "LALAMOVE" {
  if (value === "LALAMOVE") return "LALAMOVE";
  return "INTERNAL";
}

export function EditOrderForm({
  order,
  isLoading,
  isFetching,
  isError,
  version,
  submitting,
  serverError,
  onSubmit,
  onClearServerError,
}: {
  order: OrderDetail | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  version: number;
  submitting: boolean;
  serverError?: string;
  onSubmit: (payload: EditOrderPayload) => Promise<void>;
  onClearServerError: () => void;
}) {
  const initializedRef = useRef<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const errorBannerRef = useRef<HTMLDivElement>(null);
  const quantityRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  const [items, setItems] = useState<EditOrderLine[]>([]);
  const [deliveryType, setDeliveryType] = useState<
    "INTERNAL" | "LALAMOVE"
  >("INTERNAL");
  const [customerAddressId, setCustomerAddressId] = useState<
    number | undefined
  >(undefined);
  const [notes, setNotes] = useState("");
  const [touchedQty, setTouchedQty] = useState<Record<number, boolean>>({});
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(catalogSearch.trim()), 220);
    return () => clearTimeout(timer);
  }, [catalogSearch]);

  useEffect(() => {
    if (!order || isFetching || initializedRef.current === order.id) return;
    initializedRef.current = order.id;
    setItems(
      order.items.map((item) => ({
        inventory_id: item.inventory_id,
        product_name: item.product_name,
        product_variant_name: item.product_variant_name,
        product_variant_sku: item.product_variant_sku,
        quantity: item.quantity,
        quantityInput: String(item.quantity),
        price: item.price,
        originalQuantity: item.quantity,
      })),
    );
    setDeliveryType(normalizeDeliveryMethod(order.delivery_type));
    setCustomerAddressId(order.customer_address_id ?? undefined);
    setNotes(order.notes ?? "");
    setTouchedQty({});
    setSubmittedOnce(false);
    setClientError(null);
    setPickerOpen(false);
    setCatalogSearch("");
    setSearchTerm("");
    setHydrated(true);
  }, [order, isFetching]);

  const addressesQuery = useQuery({
    queryKey: ["order_customer_addresses", order?.customer_id],
    queryFn: async () => {
      const response = await request(
        "GET",
        `/api/orders/customers/${order!.customer_id}/addresses`,
      );
      if (!response.ok) {
        throw new Error("Unable to load saved shipping addresses.");
      }
      return (await response.json()) as { rows: SavedAddressOption[] };
    },
    enabled: Boolean(order?.customer_id && order.delivery_type !== "WALK_IN"),
  });

  const itemIdsKey = useMemo(
    () =>
      items
        .map((item) => item.inventory_id)
        .sort((a, b) => a - b)
        .join(","),
    [items],
  );

  const stockDetailsQuery = useQuery({
    queryKey: ["edit_order_stock", itemIdsKey],
    queryFn: async () => {
      const response = await request(
        "GET",
        `/api/inventory/details?ids=${itemIdsKey}`,
      );
      if (!response.ok) {
        throw new Error("Unable to verify live warehouse stock.");
      }
      return (await response.json()) as StockDetailRow[];
    },
    enabled: Boolean(order && itemIdsKey.length > 0),
  });

  const catalogQuery = useQuery({
    queryKey: ["edit_order_catalog", order?.warehouse_id, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "0",
        limit: "30",
        warehouse_id: String(order!.warehouse_id),
        active_only: "true",
      });
      if (searchTerm) params.set("search", searchTerm);
      const response = await request("GET", `/api/inventory?${params}`);
      if (!response.ok) {
        throw new Error("Unable to load warehouse stock.");
      }
      return (await response.json()) as CatalogRow[];
    },
    enabled: Boolean(pickerOpen && order?.warehouse_id),
  });

  const originalQtyByInventory = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of order?.items ?? []) {
      map.set(item.inventory_id, item.quantity);
    }
    return map;
  }, [order]);

  const unreservedStockByInventory = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of stockDetailsQuery.data ?? []) {
      map.set(row.inventory_id, Math.max(0, Number(row.quantity)));
    }
    return map;
  }, [stockDetailsQuery.data]);

  function getMaxQuantity(line: EditOrderLine): number | undefined {
    const unreserved = unreservedStockByInventory.get(line.inventory_id);
    if (unreserved === undefined) return undefined;
    return unreserved + line.originalQuantity;
  }

  function getLineError(line: EditOrderLine): string | null {
    const trimmed = line.quantityInput.trim();
    if (!trimmed) return "Enter a quantity of at least 1.";
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return "Use a whole number of 1 or more.";
    }
    const maxQty = getMaxQuantity(line);
    if (maxQty !== undefined && parsed > maxQty) {
      return `Only ${maxQty} available in this warehouse.`;
    }
    return null;
  }

  const isWalkIn = order?.delivery_type === "WALK_IN";

  const { total: originalTotal, paymentStatus } = order
    ? getOrderPaymentSummary(order)
    : { total: null, paymentStatus: "UNPAID" };
  const amountPaid = Number(order?.amount_paid ?? 0);

  const newTotal = useMemo(() => {
    if (items.length === 0 || items.some((item) => item.price === null)) {
      return null;
    }
    const sum = items.reduce(
      (acc, item) => acc + (item.price ?? 0) * Math.max(0, item.quantity),
      0,
    );
    return Math.round(sum * 100) / 100;
  }, [items]);

  const totalUnits = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0),
    [items],
  );

  const totalDelta =
    originalTotal !== null && newTotal !== null
      ? Math.round((newTotal - originalTotal) * 100) / 100
      : null;
  const belowAmountPaid =
    newTotal !== null && newTotal + 0.0001 < amountPaid;
  const balanceDue =
    newTotal !== null ? Math.max(0, Math.round((newTotal - amountPaid) * 100) / 100) : null;

  const itemsChanged = useMemo(() => {
    if (!order) return false;
    if (items.length !== order.items.length) return true;
    return items.some(
      (item) =>
        originalQtyByInventory.get(item.inventory_id) !== item.quantity,
    );
  }, [items, order, originalQtyByInventory]);

  const originalDeliveryType = normalizeDeliveryMethod(order?.delivery_type);
  const deliveryChanged = !isWalkIn && deliveryType !== originalDeliveryType;
  const addressChanged =
    !isWalkIn &&
    customerAddressId !== undefined &&
    customerAddressId !== (order?.customer_address_id ?? undefined);
  const notesChanged = (order?.notes ?? "") !== notes;

  const changedSections = [
    itemsChanged && "Items",
    deliveryChanged && "Delivery method",
    addressChanged && "Destination",
    notesChanged && "Notes",
  ].filter((label): label is string => Boolean(label));

  const savedAddresses = useMemo(
    () => addressesQuery.data?.rows ?? [],
    [addressesQuery.data?.rows],
  );
  const selectedSavedAddress = savedAddresses.find(
    (address) => address.id === customerAddressId,
  );
  const displayedAddressText = selectedSavedAddress
    ? formatAddress(selectedSavedAddress)
    : order?.shipping_address || "Address unavailable";

  const deliveryOptions = DELIVERY_METHOD_OPTIONS;

  function updateQuantityInput(inventoryId: number, raw: string) {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setClientError(null);
    onClearServerError();
    setItems((current) =>
      current.map((item) => {
        if (item.inventory_id !== inventoryId) return item;
        const parsed = raw === "" ? 0 : Number(raw);
        return {
          ...item,
          quantityInput: raw,
          quantity: Number.isSafeInteger(parsed) ? parsed : item.quantity,
        };
      }),
    );
  }

  function stepQuantity(inventoryId: number, delta: number) {
    setClientError(null);
    onClearServerError();
    setTouchedQty((prev) => ({ ...prev, [inventoryId]: true }));
    setItems((current) =>
      current.map((item) => {
        if (item.inventory_id !== inventoryId) return item;
        const maxQty = getMaxQuantity(item);
        const nextRaw = Math.max(1, item.quantity + delta);
        const nextQty =
          maxQty !== undefined && delta > 0
            ? Math.min(maxQty, nextRaw)
            : nextRaw;
        return {
          ...item,
          quantity: nextQty,
          quantityInput: String(nextQty),
        };
      }),
    );
  }

  function removeItem(inventoryId: number) {
    if (items.length <= 1) return;
    setClientError(null);
    onClearServerError();
    setItems((current) =>
      current.filter((item) => item.inventory_id !== inventoryId),
    );
  }

  function addCatalogItem(row: CatalogRow) {
    setClientError(null);
    onClearServerError();
    const unreserved = Math.max(0, row.quantity - row.reserved);
    const originalQty = originalQtyByInventory.get(row.id) ?? 0;
    const maxForOrder = unreserved + originalQty;
    const existing = items.find((item) => item.inventory_id === row.id);

    if (existing) {
      if (existing.quantity >= maxForOrder) return;
      const nextQty = existing.quantity + 1;
      setItems((current) =>
        current.map((item) =>
          item.inventory_id === row.id
            ? {
                ...item,
                quantity: nextQty,
                quantityInput: String(nextQty),
              }
            : item,
        ),
      );
      return;
    }

    if (maxForOrder < 1) return;
    const preservedPrice =
      order?.items.find((item) => item.inventory_id === row.id)?.price ??
      (row.price !== null ? Number(row.price) : null);

    setItems((current) => [
      ...current,
      {
        inventory_id: row.id,
        product_name: row.product_name,
        product_variant_name:
          row.variant_name || row.product_name || `Item #${row.id}`,
        product_variant_sku: row.sku || "—",
        quantity: 1,
        quantityInput: "1",
        price: preservedPrice,
        originalQuantity: originalQty,
      },
    ]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || submitting) return;

    setSubmittedOnce(true);
    setClientError(null);
    onClearServerError();

    if (!isWalkIn) {
      if (items.length === 0) {
        setClientError("Add at least one item before saving this order.");
        errorBannerRef.current?.focus();
        return;
      }

      for (const line of items) {
        const lineErr = getLineError(line);
        if (lineErr) {
          setTouchedQty((prev) => ({ ...prev, [line.inventory_id]: true }));
          setClientError(
            `${line.product_variant_name}: ${lineErr}`,
          );
          quantityRefs.current.get(line.inventory_id)?.focus();
          return;
        }
      }

      if (belowAmountPaid) {
        setClientError(
          `Order total (${newTotal !== null ? formatCurrency(newTotal) : "—"}) cannot be lower than the recorded payment of ${formatCurrency(amountPaid)}.`,
        );
        errorBannerRef.current?.focus();
        return;
      }
    }

    const payload: EditOrderPayload = {
      version,
      notes,
    };

    if (!isWalkIn) {
      if (deliveryChanged) {
        payload.delivery_type = deliveryType;
      }
      if (addressChanged && customerAddressId) {
        payload.customer_address_id = customerAddressId;
      }
      if (itemsChanged) {
        payload.items = items.map((item) => ({
          inventory_id: item.inventory_id,
          quantity: item.quantity,
        }));
      }
    }

    await onSubmit(payload);
  }

  const activeError = serverError || clientError;

  if (!hydrated && (isLoading || isFetching || !order) && !isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16">
        <Loader2
          className="size-6 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <p role="status" className="text-sm text-muted-foreground">
          Loading order details…
        </p>
      </div>
    );
  }

  if (isError && !hydrated) {
    return (
      <div className="px-6 py-12 text-center">
        <p role="alert" className="text-sm text-destructive">
          Unable to load this order. Close the dialog and try again.
        </p>
      </div>
    );
  }

  return (
    <form
      id="form"
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="grid min-h-0 min-w-0 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,1fr)_280px] lg:overflow-hidden"
    >
      {/* Left Main Editor */}
      <div className="min-w-0 space-y-6 px-5 py-5 overscroll-contain sm:px-6 lg:min-h-0 lg:overflow-y-auto">
        {activeError && (
          <div
            ref={errorBannerRef}
            tabIndex={-1}
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AlertCircle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p className="min-w-0 flex-1 leading-snug">{activeError}</p>
          </div>
        )}

        {/* Order Items Section */}
        {!isWalkIn && (
          <fieldset disabled={submitting} className="space-y-3">
            <legend className="sr-only">Order items</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Order items
                </h3>
                <p className="text-xs text-muted-foreground">
                  Adjust quantities, remove lines, or add active stock from{" "}
                  {order?.warehouse_name || "this warehouse"}. Existing item
                  prices stay locked.
                </p>
              </div>
              <Button
                type="button"
                variant={pickerOpen ? "secondary" : "outline"}
                size="sm"
                aria-expanded={pickerOpen}
                aria-controls="edit-order-catalog-panel"
                onClick={() => setPickerOpen((open) => !open)}
              >
                {pickerOpen ? (
                  <>
                    <X className="size-3.5" aria-hidden="true" />
                    Close stock picker
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" aria-hidden="true" />
                    Add item
                  </>
                )}
              </Button>
            </div>

            {pickerOpen && (
              <div
                id="edit-order-catalog-panel"
                className="space-y-3 rounded-xl border bg-muted/25 p-3.5"
              >
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    aria-label="Search warehouse stock to add"
                    placeholder="Search by product name or SKU…"
                    value={catalogSearch}
                    onChange={(event) => setCatalogSearch(event.target.value)}
                    className="bg-background pl-9"
                  />
                </div>

                {catalogQuery.isPending ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Loading warehouse stock…
                  </div>
                ) : catalogQuery.isError ? (
                  <p role="alert" className="py-3 text-xs text-destructive">
                    Unable to load warehouse stock. Try again.
                  </p>
                ) : (catalogQuery.data?.length ?? 0) === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No active stock matches this search in{" "}
                    {order?.warehouse_name || "this warehouse"}.
                  </p>
                ) : (
                  <div className="max-h-52 divide-y overflow-y-auto rounded-lg border bg-background overscroll-contain">
                    {catalogQuery.data!.map((row) => {
                      const unreserved = Math.max(0, row.quantity - row.reserved);
                      const originalQty = originalQtyByInventory.get(row.id) ?? 0;
                      const inOrderQty =
                        items.find((item) => item.inventory_id === row.id)
                          ?.quantity ?? 0;
                      const remaining = Math.max(
                        0,
                        unreserved + originalQty - inOrderQty,
                      );
                      const label =
                        row.variant_name || row.product_name || `Item #${row.id}`;
                      const showProduct =
                        row.product_name && row.product_name !== row.variant_name;

                      return (
                        <div
                          key={row.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            {showProduct && (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {row.product_name}
                              </p>
                            )}
                            <p className="truncate font-medium text-foreground">
                              {label}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">{row.sku || "—"}</span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                {row.price !== null
                                  ? formatCurrency(Number(row.price))
                                  : "Unverified"}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                {remaining} available
                              </span>
                              {inOrderQty > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="px-1.5 py-0 text-[10px] tabular-nums"
                                >
                                  {inOrderQty} in order
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={remaining < 1}
                            onClick={() => addCatalogItem(row)}
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                            {inOrderQty > 0 ? "Add 1" : "Add"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/35 hover:bg-muted/35">
                    <TableHead scope="col">Item</TableHead>
                    <TableHead scope="col" className="text-right">
                      Unit price
                    </TableHead>
                    <TableHead scope="col" className="w-36 text-center">
                      Quantity
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Subtotal
                    </TableHead>
                    <TableHead scope="col" className="w-10">
                      <span className="sr-only">Remove</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((line) => {
                    const lineError = getLineError(line);
                    const showError =
                      Boolean(lineError) &&
                      (touchedQty[line.inventory_id] || submittedOnce);
                    const maxQty = getMaxQuantity(line);
                    const isNew = line.originalQuantity === 0;
                    const isQtyChanged =
                      !isNew && line.quantity !== line.originalQuantity;
                    const showProduct =
                      line.product_name &&
                      line.product_name !== line.product_variant_name;
                    const subtotal =
                      line.price !== null
                        ? Math.round(line.price * Math.max(0, line.quantity) * 100) /
                          100
                        : null;
                    const errorId = `edit-qty-error-${line.inventory_id}`;

                    return (
                      <TableRow key={line.inventory_id}>
                        <TableCell className="whitespace-normal">
                          {showProduct && (
                            <p className="text-xs text-muted-foreground">
                              {line.product_name}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-foreground">
                              {line.product_variant_name}
                            </span>
                            {isNew && (
                              <Badge
                                variant="secondary"
                                className="px-1.5 py-0 text-[10px]"
                              >
                                New
                              </Badge>
                            )}
                            {isQtyChanged && (
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                (was {line.originalQuantity})
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-xs text-muted-foreground">
                            {line.product_variant_sku}
                          </p>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                          {line.price === null
                            ? "Unverified"
                            : formatCurrency(line.price)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="size-7"
                                aria-label={`Decrease quantity for ${line.product_variant_name}`}
                                disabled={line.quantity <= 1}
                                onClick={() =>
                                  stepQuantity(line.inventory_id, -1)
                                }
                              >
                                <Minus className="size-3" aria-hidden="true" />
                              </Button>
                              <Input
                                ref={(node) => {
                                  if (node) {
                                    quantityRefs.current.set(
                                      line.inventory_id,
                                      node,
                                    );
                                  } else {
                                    quantityRefs.current.delete(
                                      line.inventory_id,
                                    );
                                  }
                                }}
                                type="text"
                                inputMode="numeric"
                                aria-label={`Quantity for ${line.product_variant_name}`}
                                aria-invalid={showError ? "true" : "false"}
                                aria-describedby={showError ? errorId : undefined}
                                value={line.quantityInput}
                                onChange={(event) =>
                                  updateQuantityInput(
                                    line.inventory_id,
                                    event.target.value,
                                  )
                                }
                                onBlur={() =>
                                  setTouchedQty((prev) => ({
                                    ...prev,
                                    [line.inventory_id]: true,
                                  }))
                                }
                                className={cn(
                                  "h-7 w-14 px-1.5 text-center text-sm tabular-nums",
                                  showError &&
                                    "border-destructive focus-visible:ring-destructive",
                                )}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="size-7"
                                aria-label={`Increase quantity for ${line.product_variant_name}`}
                                disabled={
                                  maxQty !== undefined &&
                                  line.quantity >= maxQty
                                }
                                onClick={() =>
                                  stepQuantity(line.inventory_id, 1)
                                }
                              >
                                <Plus className="size-3" aria-hidden="true" />
                              </Button>
                            </div>
                            {showError ? (
                              <p
                                id={errorId}
                                className="text-center text-[11px] leading-tight text-destructive"
                              >
                                {lineError}
                              </p>
                            ) : maxQty !== undefined ? (
                              <p className="text-[11px] text-muted-foreground tabular-nums">
                                Max {maxQty}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                          {subtotal === null
                            ? "Unverified"
                            : formatCurrency(subtotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${line.product_variant_name}`}
                            disabled={items.length <= 1}
                            title={
                              items.length <= 1
                                ? "An order must have at least one item"
                                : `Remove ${line.product_variant_name}`
                            }
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(line.inventory_id)}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </fieldset>
        )}

        {/* Delivery Method Section */}
        {!isWalkIn && (
          <fieldset disabled={submitting} className="space-y-2.5">
            <legend className="text-sm font-semibold tracking-tight text-foreground">
              Delivery method
            </legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {deliveryOptions.map((option) => {
                const selectedOption = deliveryType === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      selectedOption
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/35",
                    )}
                  >
                    <input
                      type="radio"
                      name="edit-delivery-method"
                      value={option.value}
                      checked={selectedOption}
                      onChange={() => {
                        setClientError(null);
                        onClearServerError();
                        setDeliveryType(option.value);
                      }}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selectedOption
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background",
                      )}
                      aria-hidden="true"
                    >
                      {selectedOption && <Check className="size-2.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* Shipping Destination Section */}
        {!isWalkIn && order && (
          <fieldset disabled={submitting} className="space-y-3">
            <legend className="text-sm font-semibold tracking-tight text-foreground">
              Shipping destination
            </legend>
            <p className="-mt-2 text-xs text-muted-foreground">
              Select one of {order.customer_name}&apos;s saved addresses or
              save a new destination.
            </p>

            {savedAddresses.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="edit-shipping-address">
                  Saved shipping address
                </Label>
                <Select
                  value={
                    customerAddressId !== undefined
                      ? String(customerAddressId)
                      : ""
                  }
                  onValueChange={(value) => {
                    if (!value) return;
                    const parsed = Number(value);
                    if (Number.isSafeInteger(parsed) && parsed > 0) {
                      setClientError(null);
                      onClearServerError();
                      setCustomerAddressId(parsed);
                    }
                  }}
                >
                  <SelectTrigger
                    id="edit-shipping-address"
                    className="h-auto min-h-10 w-full py-2 text-left whitespace-normal"
                  >
                    <SelectValue placeholder="Keep current destination snapshot">
                      {selectedSavedAddress
                        ? formatAddress(selectedSavedAddress)
                        : order.shipping_address || "Select a saved address"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {savedAddresses.map((address) => (
                      <SelectItem key={address.id} value={String(address.id)}>
                        {formatAddress(address)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : addressesQuery.isPending ? (
              <p className="text-xs text-muted-foreground">
                Loading saved addresses…
              </p>
            ) : null}

            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-3 text-xs">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium text-foreground">
                  {addressChanged
                    ? "Updated destination"
                    : "Current destination"}
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  {displayedAddressText}
                </p>
                {(order.shipping_recipient || order.shipping_phone) && (
                  <p className="text-muted-foreground">
                    {[order.shipping_recipient, order.shipping_phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </div>

            <SavedAddressForm
              customerId={order.customer_id}
              onSaved={async (saved) => {
                await addressesQuery.refetch();
                setClientError(null);
                onClearServerError();
                setCustomerAddressId(saved.id);
              }}
            />
          </fieldset>
        )}

        {/* Order Notes Section */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="order-notes" className="text-sm font-semibold">
              Order notes
            </Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {notes.length} / 2000
            </span>
          </div>
          <Textarea
            id="order-notes"
            rows={3}
            disabled={!order || submitting}
            maxLength={2000}
            placeholder="Add delivery instructions, packing notes, or customer requests…"
            value={notes}
            onChange={(event) => {
              setClientError(null);
              onClearServerError();
              setNotes(event.target.value);
            }}
          />
        </div>
      </div>

      {/* Right Summary Sidebar */}
      <aside
        aria-label="Order summary"
        className="flex flex-col gap-4 border-t bg-muted/20 p-5 lg:min-h-0 lg:overflow-y-auto lg:border-t-0 lg:border-l"
      >
        {order && (
          <>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">
                  {order.order_number}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    getOrderStatusBadgeClass(order.status),
                  )}
                >
                  {formatOrderLabel(order.status)}
                </span>
              </div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-muted-foreground">Customer</dt>
                  <dd className="text-right font-medium text-foreground">
                    {order.customer_name}
                    {order.customer_company && (
                      <span className="block font-normal text-muted-foreground">
                        {order.customer_company}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Warehouse</dt>
                  <dd className="text-right font-medium text-foreground">
                    {order.warehouse_name || "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Method</dt>
                  <dd className="inline-flex items-center gap-1 text-right font-medium text-foreground">
                    <Truck className="size-3 text-muted-foreground" aria-hidden="true" />
                    {formatOrderLabel(deliveryType)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-2.5 border-t pt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Package className="size-3.5" aria-hidden="true" />
                  Items summary
                </span>
                <span className="tabular-nums">
                  {items.length} {items.length === 1 ? "line" : "lines"} ·{" "}
                  {totalUnits} {totalUnits === 1 ? "unit" : "units"}
                </span>
              </div>

              <dl className="space-y-1.5 rounded-lg border bg-background p-3 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">Order total</dt>
                  <dd className="text-sm font-semibold text-foreground tabular-nums">
                    {newTotal === null
                      ? "Unverified"
                      : formatCurrency(newTotal)}
                  </dd>
                </div>
                {totalDelta !== null && totalDelta !== 0 && (
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Change</dt>
                    <dd
                      className={cn(
                        "font-medium tabular-nums",
                        totalDelta > 0
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      {totalDelta > 0 ? "+" : ""}
                      {formatCurrency(totalDelta)}
                    </dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-2 border-t pt-1.5">
                  <dt className="text-muted-foreground">Recorded paid</dt>
                  <dd className="font-medium text-foreground tabular-nums">
                    {formatCurrency(amountPaid)}
                  </dd>
                </div>
                {balanceDue !== null && (
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Balance due</dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {formatCurrency(balanceDue)}
                    </dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">Payment</dt>
                  <dd className="text-right text-muted-foreground">
                    {formatOrderLabel(paymentStatus)} ·{" "}
                    {formatOrderLabel(order.payment_arrangement)}
                  </dd>
                </div>
              </dl>

              {belowAmountPaid && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertCircle
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <p className="leading-snug">
                    Total is below the recorded payment of{" "}
                    {formatCurrency(amountPaid)}. Increase quantities or record
                    a refund in Payments first.
                  </p>
                </div>
              )}

              {!belowAmountPaid &&
                itemsChanged &&
                order.payment_arrangement === "FULLY_PAID" &&
                newTotal !== null &&
                newTotal > amountPaid && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                    <Info
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="leading-snug">
                      Adding items creates an unpaid balance of{" "}
                      {formatCurrency(newTotal - amountPaid)}. Payment status
                      will update automatically.
                    </p>
                  </div>
                )}

              {order.combined_payment && (
                <div className="flex items-start gap-2 rounded-lg border bg-background p-2.5 text-xs text-muted-foreground">
                  <Info
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <p className="leading-snug">
                    Allocated from combined receipt{" "}
                    <span className="font-mono font-medium text-foreground">
                      {order.combined_payment.payment_number}
                    </span>
                    .
                  </p>
                </div>
              )}
            </div>

            <div className="mt-auto space-y-1.5 border-t pt-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Pending changes
              </p>
              {changedSections.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {changedSections.map((section) => (
                    <Badge
                      key={section}
                      variant="secondary"
                      className="text-[11px] font-medium"
                    >
                      {section}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No changes made yet.
                </p>
              )}
            </div>
          </>
        )}
      </aside>
    </form>
  );
}
