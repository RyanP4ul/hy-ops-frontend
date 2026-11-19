"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Loader2,
  Minus,
  Plus,
  Printer,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useOrders } from "../../provider";
import { QueryFeedback } from "@/components/query-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PaymentTypeCombobox } from "@/components/payment-type-combobox";
import { request } from "@/components/http";
import { formatCurrency } from "@/utils/date-util";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { cn } from "@/lib/utils";
import {
  walkInOrderFormSchema,
  type WalkInCartItem,
  type WalkInSaleResult,
} from "@/schema/walk-in-order";
import Invoice from "../invoice";
import {
  DeliveryFields,
  type DeliveryDetails,
  type DeliveryFieldErrors,
  type SavedDeliveryAddress,
} from "./delivery-fields";

type InventoryCatalogRow = {
  id: number;
  product_name: string | null;
  description: string | null;
  sku: string | null;
  warehouse_name: string | null;
  reserved: number;
  quantity: number;
  price: string | null;
  version: number;
};

type WarehouseOption = {
  id: number;
  name: string;
};

type CustomerOption = {
  addresses: SavedDeliveryAddress[];
  id: number;
  name: string;
  company_name: string;
  phone_number: string;
};

export function WalkInSaleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { isStaff, assignedWarehouse, warehouseQuery } = useOrders();
  const { send } = useWebSocket();

  const [selectedWarehouseId, setWarehouseId] = useState<number>(-1);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [buyerMode, setBuyerMode] = useState<"GUEST" | "REGISTERED">("GUEST");
  const [customerId, setCustomerId] = useState<number | undefined>(undefined);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<"TAKEAWAY" | "DELIVERY">(
    "TAKEAWAY",
  );
  const [delivery, setDelivery] = useState<DeliveryDetails>({
    shipping_recipient: "",
    shipping_phone: "",
    shipping_address: "",
  });
  const checkoutKey = useRef<string | null>(null);
  const pendingPayload = useRef<Record<string, unknown> | null>(null);
  const [retryPending, setRetryPending] = useState(false);
  const submitLock = useRef(false);
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [cart, setCart] = useState<WalkInCartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "BANK_TRANSFER" | "CARD"
  >("CASH");
  const [paymentType, setPaymentType] = useState("");
  const [paymentTypeTouched, setPaymentTypeTouched] = useState(false);
  const [enteredTenderedInput, setAmountTenderedInput] = useState<string>("");
  const [tenderedManuallyEdited, setTenderedManuallyEdited] = useState(false);
  const [tenderedTouched, setTenderedTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<WalkInSaleResult | null>(
    null,
  );
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);

  const errorBannerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tenderedInputRef = useRef<HTMLInputElement>(null);

  const warehousesQuery = useQuery({
    queryKey: ["walk_in_warehouses"],
    queryFn: async () => {
      const res = await request("GET", "/api/warehouses/names?page=0&limit=50");
      if (!res.ok) throw new Error("Unable to load warehouses.");
      return (await res.json()) as { rows: WarehouseOption[]; total: number };
    },
    enabled: open,
  });

  const customersQuery = useQuery({
    queryKey: ["walk_in_customers"],
    queryFn: async () => {
      const res = await request("GET", "/api/users/customers?page=0&limit=50");
      if (!res.ok) throw new Error("Unable to load customers.");
      return (await res.json()) as { rows: CustomerOption[]; total: number };
    },
    enabled: open && buyerMode === "REGISTERED",
  });

  const warehouseId = isStaff
    ? (assignedWarehouse?.id ?? -1)
    : selectedWarehouseId > 0
      ? selectedWarehouseId
      : (warehousesQuery.data?.rows[0]?.id ?? -1);

  const catalogQuery = useQuery({
    queryKey: ["walk_in_catalog", warehouseId, catalogSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "0",
        limit: "40",
        warehouse_id: String(warehouseId),
        active_only: "true",
      });
      if (catalogSearch.trim()) {
        params.set("search", catalogSearch.trim());
      }
      const res = await request("GET", `/api/inventory?${params.toString()}`);
      if (!res.ok) throw new Error("Unable to load warehouse stock.");
      return (await res.json()) as InventoryCatalogRow[];
    },
    enabled: open && warehouseId > 0,
  });

  const cartTotal = useMemo(() => {
    const sum = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    return Math.round(sum * 100) / 100;
  }, [cart]);

  const totalUnits = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const amountTenderedInput =
    paymentMethod !== "CASH" || !tenderedManuallyEdited
      ? cartTotal > 0
        ? cartTotal.toFixed(2)
        : ""
      : enteredTenderedInput;

  const parsedTendered = useMemo(() => {
    const num = Number(amountTenderedInput);
    return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) / 100 : 0;
  }, [amountTenderedInput]);

  const changeDue = useMemo(
    () => Math.round((parsedTendered - cartTotal) * 100) / 100,
    [parsedTendered, cartTotal],
  );

  const deliveryErrors = useMemo<DeliveryFieldErrors>(() => {
    if (fulfillment !== "DELIVERY") return {};
    const next: DeliveryFieldErrors = {};
    if (!delivery.shipping_recipient.trim()) {
      next.shipping_recipient = "Enter recipient name.";
    }
    if (!delivery.shipping_phone.trim()) {
      next.shipping_phone = "Enter phone number.";
    } else if (
      !/^[+()\d\s.-]{7,20}$/.test(delivery.shipping_phone.trim()) ||
      delivery.shipping_phone.replace(/\D/g, "").length < 7
    ) {
      next.shipping_phone = "Enter a valid phone number.";
    }
    if (!delivery.shipping_address.trim()) {
      next.shipping_address = "Enter delivery address.";
    }
    if (
      delivery.shipping_latitude === undefined ||
      delivery.shipping_longitude === undefined ||
      (delivery.shipping_latitude === 0 && delivery.shipping_longitude === 0)
    ) {
      next.shipping_latitude = "Pin destination on the map or enter coordinates.";
    }
    return next;
  }, [fulfillment, delivery]);

  const showPaymentTypeError =
    paymentMethod !== "CASH" &&
    (submitted || paymentTypeTouched) &&
    !paymentType.trim();

  const showTenderedShort =
    paymentMethod === "CASH" &&
    cartTotal > 0 &&
    (submitted || tenderedTouched) &&
    changeDue < 0;

  function changeFulfillment(next: "TAKEAWAY" | "DELIVERY") {
    if (next === fulfillment) return;
    if (buyerMode === "GUEST") {
      if (next === "TAKEAWAY") {
        setWalkInName(delivery.shipping_recipient);
        setWalkInPhone(delivery.shipping_phone);
      } else {
        setDelivery((current) => ({
          ...current,
          shipping_recipient: walkInName,
          shipping_phone: walkInPhone,
        }));
      }
    }
    setFormError(null);
    setFulfillment(next);
  }

  function changeBuyerMode(next: "GUEST" | "REGISTERED") {
    if (next === buyerMode) return;
    if (buyerMode === "GUEST" && fulfillment === "DELIVERY") {
      setWalkInName(delivery.shipping_recipient);
      setWalkInPhone(delivery.shipping_phone);
    }
    setBuyerMode(next);
    setCustomerId(undefined);
    setFormError(null);
    setDelivery({
      shipping_recipient: next === "GUEST" ? walkInName : "",
      shipping_phone: next === "GUEST" ? walkInPhone : "",
      shipping_address: "",
    });
  }

  function resetSaleState() {
    checkoutKey.current = null;
    pendingPayload.current = null;
    setRetryPending(false);
    setFulfillment("TAKEAWAY");
    setDelivery({
      shipping_recipient: "",
      shipping_phone: "",
      shipping_address: "",
    });
    setCatalogSearch("");
    setBuyerMode("GUEST");
    setCustomerId(undefined);
    setWalkInName("");
    setWalkInPhone("");
    setNotes("");
    setNotesOpen(false);
    setCart([]);
    setPaymentMethod("CASH");
    setPaymentType("");
    setPaymentTypeTouched(false);
    setAmountTenderedInput("");
    setTenderedManuallyEdited(false);
    setTenderedTouched(false);
    setSubmitted(false);
    setFormError(null);
    setCompletedSale(null);
    setShowInvoicePreview(false);
  }

  function addItemToCart(row: InventoryCatalogRow) {
    const available = Math.max(0, row.quantity - row.reserved);
    const price = Number(row.price ?? 0);
    if (available <= 0) {
      toast.error(`${row.sku ?? "Item"} is out of stock.`);
      return;
    }

    setFormError(null);
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.inventory_id === row.id);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex]!;
        if (existing.quantity + 1 > available) {
          toast.error(`Only ${available} of ${existing.sku} available.`);
          return prev;
        }
        return prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + 1, available }
            : item,
        );
      }
      return [
        ...prev,
        {
          inventory_id: row.id,
          sku: row.sku ?? `INV-${row.id}`,
          product_name: row.product_name ?? "Product",
          description: row.description ?? "",
          price,
          available,
          quantity: 1,
        },
      ];
    });
  }

  function updateItemQuantity(inventoryId: number, nextQuantity: number) {
    setFormError(null);
    setCart((prev) =>
      prev.map((item) => {
        if (item.inventory_id !== inventoryId) return item;
        const clamped = Math.max(
          1,
          Math.min(item.available, Math.floor(nextQuantity || 1)),
        );
        return { ...item, quantity: clamped };
      }),
    );
  }

  function removeItemFromCart(inventoryId: number) {
    setFormError(null);
    setCart((prev) =>
      prev.filter((item) => item.inventory_id !== inventoryId),
    );
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // Do not hijack Enter while an IME composition is active (Safari reports keyCode 229).
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const rows = catalogQuery.data ?? [];
    if (!rows.length) return;
    const normalized = catalogSearch.trim().toLowerCase();
    const exactSku = rows.find(
      (r) => (r.sku ?? "").toLowerCase() === normalized,
    );
    const candidate =
      exactSku ?? rows.find((r) => r.quantity - r.reserved > 0) ?? rows[0];
    if (candidate) {
      addItemToCart(candidate);
    }
  }

  function focusFirstInvalid(pathKey?: string | number) {
    requestAnimationFrame(() => {
      if (pathKey === "items") {
        searchInputRef.current?.focus();
        return;
      }
      if (pathKey === "amount_tendered") {
        tenderedInputRef.current?.focus();
        return;
      }
      if (typeof pathKey === "string" && pathKey.startsWith("shipping_")) {
        const el = document.getElementById(`delivery-${pathKey}`);
        if (el) {
          el.focus();
          return;
        }
      }
      errorBannerRef.current?.focus();
    });
  }

  async function handleCompleteSale(e: React.FormEvent) {
    e.preventDefault();
    if (submitLock.current) return;
    setSubmitted(true);
    setFormError(null);

    const effectiveTendered =
      paymentMethod === "CASH" ? parsedTendered : cartTotal;

    const validation = walkInOrderFormSchema.safeParse({
      fulfillment,
      ...(fulfillment === "DELIVERY" ? delivery : {}),
      warehouse_id: warehouseId,
      buyer_mode: buyerMode,
      customer_id: buyerMode === "REGISTERED" ? customerId : undefined,
      walk_in_name: buyerMode === "GUEST" ? walkInName : undefined,
      walk_in_phone: buyerMode === "GUEST" ? walkInPhone : undefined,
      notes,
      payment_method: paymentMethod,
      payment_type:
        paymentMethod === "CASH" ? undefined : paymentType.trim(),
      amount_tendered: effectiveTendered,
      items: cart,
    });

    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      setFormError(firstIssue?.message ?? "Review the highlighted fields.");
      focusFirstInvalid(firstIssue?.path[0]);
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    try {
      checkoutKey.current ??= crypto.randomUUID();
      const payload = pendingPayload.current ?? {
        checkout_key: checkoutKey.current,
        fulfillment: validation.data.fulfillment,
        ...(validation.data.fulfillment === "DELIVERY" ? delivery : {}),
        warehouse_id: validation.data.warehouse_id,
        customer_id:
          validation.data.buyer_mode === "REGISTERED"
            ? validation.data.customer_id
            : undefined,
        walk_in_name:
          validation.data.buyer_mode === "GUEST" &&
          validation.data.walk_in_name?.trim()
            ? validation.data.walk_in_name.trim()
            : undefined,
        walk_in_phone:
          validation.data.buyer_mode === "GUEST" &&
          validation.data.walk_in_phone?.trim()
            ? validation.data.walk_in_phone.trim()
            : undefined,
        notes: validation.data.notes?.trim() || undefined,
        payment_method: validation.data.payment_method,
        payment_type:
          validation.data.payment_method === "CASH"
            ? undefined
            : validation.data.payment_type?.trim(),
        amount_tendered: validation.data.amount_tendered,
        items: validation.data.items.map((item) => ({
          inventory_id: item.inventory_id,
          quantity: item.quantity,
        })),
      };

      pendingPayload.current = payload;
      setRetryPending(true);
      const response = await request("POST", "/api/orders/walk-in", payload);
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          pendingPayload.current = null;
          setRetryPending(false);
        }
        setFormError(body?.message || "Unable to complete sale.");
        focusFirstInvalid();
        return;
      }

      const saleResult = body as WalkInSaleResult;
      pendingPayload.current = null;
      setRetryPending(false);
      setCompletedSale(saleResult);
      send({
        type: REQUESTS.ORDER_ADDED,
        payload: [JSON.stringify(saleResult)],
      });

      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard_query"] });
      void queryClient.invalidateQueries({ queryKey: ["walk_in_catalog"] });

      toast.success(
        saleResult.message ||
          `Order ${saleResult.order_number} completed.`,
      );
    } catch {
      setFormError(
        "Unable to confirm checkout. Retry this same sale to recover the payment result.",
      );
      focusFirstInvalid();
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const warehouses = warehousesQuery.data?.rows ?? [];
  const registeredCustomer = customersQuery.data?.rows.find(
    (c) => c.id === customerId,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitLock.current) return;
        if (!nextOpen && !pendingPayload.current) resetSaleState();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {completedSale ? (
          <div className="max-h-[92dvh] overflow-y-auto p-6 space-y-5">
            <DialogHeader className="space-y-1.5 pr-8">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                >
                  <Check className="size-3.5" />
                </span>
                <DialogTitle className="text-lg font-semibold">
                  {completedSale.order_number || completedSale.product_number}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs">
                {completedSale.delivery_type === "INTERNAL"
                  ? "Paid and stock reserved. Assign a driver in delivery scheduling."
                  : `Paid · ${completedSale.customer_name || "Walk-in customer"}`}
              </DialogDescription>
            </DialogHeader>

            {completedSale.delivery_type === "INTERNAL" && (
              <Link
                href="/panel/delivery-schedules"
                onClick={() => {
                  resetSaleState();
                  onOpenChange(false);
                }}
                className="inline-flex text-xs font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                Open delivery scheduling →
              </Link>
            )}

            <div className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-3 sm:divide-x">
              <div className="border-b px-4 py-3.5 sm:border-b-0">
                <p className="text-xs text-muted-foreground">Total paid</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                  {formatCurrency(completedSale.total)}
                </p>
              </div>
              <div className="border-b px-4 py-3.5 sm:border-b-0">
                <p className="text-xs text-muted-foreground">Tendered</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                  {formatCurrency(completedSale.amount_tendered)}
                </p>
              </div>
              <div className="bg-emerald-500/[0.08] px-4 py-3.5">
                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  Change
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(completedSale.change_due)}
                </p>
              </div>
            </div>

            {showInvoicePreview ? (
              <div className="rounded-xl border bg-card p-4">
                <Invoice orderId={completedSale.id} />
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
                <span className="text-sm font-medium">Receipt ready</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInvoicePreview(true)}
                >
                  <Printer className="size-3.5" aria-hidden="true" />
                  Print / view receipt
                </Button>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  resetSaleState();
                  onOpenChange(false);
                }}
              >
                Close
              </Button>
              <Button type="button" size="sm" onClick={resetSaleState}>
                New sale
              </Button>
            </div>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={handleCompleteSale}
            aria-labelledby="walkin-dialog-title"
            className="flex max-h-[92dvh] min-w-0 flex-col"
          >
            {/* Compact Top Bar: Title + Fulfillment + Warehouse */}
            <DialogHeader className="shrink-0 border-b px-5 py-3.5 pr-12">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <DialogTitle
                    id="walkin-dialog-title"
                    className="text-base font-semibold tracking-tight"
                  >
                    Walk-in sale
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Add warehouse stock, choose takeaway or delivery, and record
                    full payment.
                  </DialogDescription>

                  {/* Native radio group styled as compact switch */}
                  <fieldset
                    disabled={submitting || retryPending}
                    className="inline-flex rounded-lg bg-muted p-0.5"
                  >
                    <legend className="sr-only">Fulfillment type</legend>
                    {(
                      [
                        { value: "TAKEAWAY", label: "Takeaway" },
                        { value: "DELIVERY", label: "Delivery" },
                      ] as const
                    ).map((opt) => {
                      const active = fulfillment === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={cn(
                            "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-ring",
                            active
                              ? "bg-background text-foreground shadow-2xs"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <input
                            type="radio"
                            name="walkin-fulfillment"
                            value={opt.value}
                            checked={active}
                            onChange={() => changeFulfillment(opt.value)}
                            className="sr-only"
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </fieldset>
                </div>

                {/* Warehouse picker in header */}
                <div className="flex items-center gap-2">
                  {isStaff ? (
                    assignedWarehouse ? (
                      <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {assignedWarehouse.name}
                      </span>
                    ) : null
                  ) : (
                    <Select
                      value={warehouseId > 0 ? String(warehouseId) : ""}
                      disabled={
                        warehouses.length <= 1 || submitting || retryPending
                      }
                      onValueChange={(val) => {
                        const nextId = Number(val);
                        if (nextId && nextId !== warehouseId) {
                          setWarehouseId(nextId);
                          setCart([]);
                        }
                      }}
                    >
                      <SelectTrigger
                        aria-label="Warehouse"
                        className="h-8 w-auto min-w-[160px] text-xs"
                      >
                        <SelectValue placeholder="Warehouse">
                          {warehouses.find((w) => w.id === warehouseId)?.name ??
                            "Select warehouse"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {warehouses.map((w) => (
                            <SelectItem key={w.id} value={String(w.id)}>
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </DialogHeader>

            {/* Alerts */}
            {(formError || retryPending || (isStaff && warehouseQuery.isError)) && (
              <div className="shrink-0 space-y-2 border-b bg-muted/20 px-5 py-2.5">
                {isStaff && (
                  <QueryFeedback
                    query={warehouseQuery}
                    label="assigned warehouse"
                  />
                )}
                {formError && (
                  <div
                    ref={errorBannerRef}
                    tabIndex={-1}
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive outline-none"
                  >
                    {formError}
                  </div>
                )}
                {retryPending && (
                  <p
                    role="status"
                    className="text-xs text-amber-800 dark:text-amber-300"
                  >
                    Checkout held while confirming payment. Use Retry checkout to
                    recover safely.
                  </p>
                )}
              </div>
            )}

            {/* Main 2-column POS Body */}
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1.2fr)_370px] lg:overflow-hidden">
              {/* Left Column: Products first, then Customer & Delivery */}
              <fieldset
                disabled={submitting || retryPending}
                className="min-w-0 space-y-4 p-5 lg:overflow-y-auto"
              >
                <legend className="sr-only">Products and customer details</legend>
                {/* Product Picker */}
                <search className="space-y-2.5">
                  <div className="relative">
                    <label htmlFor="walkin-sku-search" className="sr-only">
                      Search products or scan SKU
                    </label>
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      ref={searchInputRef}
                      id="walkin-sku-search"
                      name="catalog_search"
                      type="search"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      enterKeyHint="search"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Search product or scan SKU (Enter to add)"
                      className="h-10 pr-8 pl-9 text-base sm:text-sm"
                    />
                    {catalogSearch && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setCatalogSearch("")}
                        className="absolute top-1/2 right-2.5 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 divide-y overflow-y-auto rounded-xl border bg-background">
                    {catalogQuery.isPending ? (
                      <div
                        role="status"
                        className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground"
                      >
                        <Loader2 className="size-4 animate-spin" />
                        Loading stock...
                      </div>
                    ) : !(catalogQuery.data ?? []).length ? (
                      <p className="py-8 text-center text-xs text-muted-foreground">
                        No matching items in stock.
                      </p>
                    ) : (
                      (catalogQuery.data ?? []).map((row) => {
                        const available = Math.max(
                          0,
                          row.quantity - row.reserved,
                        );
                        const inCart = cart.find(
                          (c) => c.inventory_id === row.id,
                        );
                        const price = Number(row.price ?? 0);
                        const maxed = inCart
                          ? inCart.quantity >= available
                          : false;

                        return (
                          <div
                            key={row.id}
                            className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/35"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="truncate text-sm font-medium text-foreground">
                                  {row.product_name || row.sku}
                                </span>
                                {row.sku && (
                                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                                    {row.sku}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {row.description ? `${row.description} · ` : ""}
                                <span
                                  className={
                                    available > 0
                                      ? "text-muted-foreground"
                                      : "font-medium text-destructive"
                                  }
                                >
                                  {available > 0
                                    ? `${available} left`
                                    : "Out of stock"}
                                </span>
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-3">
                              <span className="text-sm font-medium tabular-nums">
                                {formatCurrency(price)}
                              </span>
                              <Button
                                type="button"
                                size="xs"
                                variant={inCart ? "secondary" : "outline"}
                                className="h-8 min-w-[64px] px-2.5 text-xs"
                                disabled={available <= 0 || maxed}
                                onClick={() => addItemToCart(row)}
                              >
                                <Plus className="size-3" aria-hidden="true" />
                                {inCart ? inCart.quantity : "Add"}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </search>

                {/* Customer Row */}
                <fieldset className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <legend className="text-xs font-semibold text-foreground">
                      Customer
                    </legend>

                    <div
                      role="group"
                      aria-label="Buyer type"
                      className="inline-flex rounded-lg bg-muted p-0.5"
                    >
                      {(
                        [
                          { id: "GUEST", label: "Guest" },
                          { id: "REGISTERED", label: "Registered" },
                        ] as const
                      ).map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          aria-pressed={buyerMode === mode.id}
                          onClick={() => changeBuyerMode(mode.id)}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                            buyerMode === mode.id
                              ? "bg-background text-foreground shadow-2xs"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {buyerMode === "GUEST" && fulfillment === "TAKEAWAY" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label
                          htmlFor="walkin-name"
                          className="block text-xs text-muted-foreground"
                        >
                          Name (optional)
                        </label>
                        <Input
                          id="walkin-name"
                          name="walk_in_name"
                          type="text"
                          autoComplete="name"
                          enterKeyHint="next"
                          value={walkInName}
                          onChange={(e) => {
                            setWalkInName(e.target.value);
                            setDelivery((current) => ({
                              ...current,
                              shipping_recipient: e.target.value,
                            }));
                          }}
                          placeholder="Walk-in customer"
                          maxLength={60}
                          className="h-9 text-base sm:text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="walkin-phone"
                          className="block text-xs text-muted-foreground"
                        >
                          Phone (optional)
                        </label>
                        <Input
                          id="walkin-phone"
                          name="walk_in_phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          enterKeyHint="done"
                          value={walkInPhone}
                          onChange={(e) => {
                            setWalkInPhone(e.target.value);
                            setDelivery((current) => ({
                              ...current,
                              shipping_phone: e.target.value,
                            }));
                          }}
                          placeholder="0917-000-0000"
                          maxLength={20}
                          className="h-9 text-base sm:text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {buyerMode === "REGISTERED" && (
                    <div className="space-y-1">
                      <label
                        htmlFor="walkin-registered-customer"
                        className="block text-xs text-muted-foreground"
                      >
                        Account{" "}
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </label>
                      <Select
                        value={customerId ? String(customerId) : ""}
                        onValueChange={(val) => {
                          if (Number(val) === customerId) return;
                          const buyer = customersQuery.data?.rows.find(
                            (customer) => customer.id === Number(val),
                          );
                          setCustomerId(Number(val));
                          setFormError(null);
                          setDelivery({
                            shipping_recipient: buyer?.name ?? "",
                            shipping_phone: buyer?.phone_number ?? "",
                            shipping_address: "",
                          });
                        }}
                      >
                        <SelectTrigger
                          id="walkin-registered-customer"
                          aria-invalid={
                            submitted && !customerId ? "true" : "false"
                          }
                          aria-describedby={
                            submitted && !customerId
                              ? "walkin-customer-error"
                              : undefined
                          }
                          className={cn(
                            "h-9 w-full text-sm",
                            submitted && !customerId && "border-destructive",
                          )}
                        >
                          <SelectValue placeholder="Select customer">
                            {registeredCustomer
                              ? `${registeredCustomer.name}${
                                  registeredCustomer.company_name
                                    ? ` (${registeredCustomer.company_name})`
                                    : ""
                                }`
                              : "Select customer"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {(customersQuery.data?.rows ?? []).map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                                {c.company_name ? ` (${c.company_name})` : ""}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {submitted && !customerId && (
                        <p
                          id="walkin-customer-error"
                          className="text-xs text-destructive"
                        >
                          Select a registered customer or switch to Guest.
                        </p>
                      )}
                    </div>
                  )}
                </fieldset>

                {/* Delivery Fields */}
                {fulfillment === "DELIVERY" && (
                  <DeliveryFields
                    value={delivery}
                    onChange={(next) => {
                      setFormError(null);
                      setDelivery(next);
                    }}
                    addresses={
                      buyerMode === "REGISTERED"
                        ? registeredCustomer?.addresses
                        : []
                    }
                    errors={deliveryErrors}
                    submitted={submitted}
                  />
                )}

                {/* Collapsible Note */}
                <div>
                  {notesOpen || notes ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="walkin-notes"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Note
                        </label>
                        {!notes && (
                          <button
                            type="button"
                            onClick={() => setNotesOpen(false)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Hide
                          </button>
                        )}
                      </div>
                      <Textarea
                        id="walkin-notes"
                        name="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Receipt remarks or serial numbers..."
                        rows={2}
                        maxLength={2000}
                        className="text-base sm:text-sm"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNotesOpen(true)}
                      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      + Add note
                    </button>
                  )}
                </div>
              </fieldset>

              {/* Right Column: Cart + Payment + Submit */}
              <div className="flex min-w-0 flex-col border-t bg-muted/20 lg:overflow-hidden lg:border-t-0 lg:border-l">
                {/* Cart Header */}
                <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Cart</h3>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {totalUnits} {totalUnits === 1 ? "unit" : "units"}
                    </span>
                  </div>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      disabled={submitting || retryPending}
                      onClick={() => setCart([])}
                      className="text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Cart Items */}
                <fieldset
                  disabled={submitting || retryPending}
                  className="min-h-32 flex-1 overflow-y-auto px-5 py-2"
                >
                  <legend className="sr-only">Cart items</legend>
                  {!cart.length ? (
                    <div className="flex h-full min-h-32 items-center justify-center text-center">
                      <p className="text-xs text-muted-foreground">
                        Add items from stock to start.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {cart.map((item) => (
                        <li
                          key={item.inventory_id}
                          className="space-y-2 py-3 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {item.product_name}
                              </p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {item.sku} · {formatCurrency(item.price)}
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-label={`Remove ${item.sku}`}
                              onClick={() =>
                                removeItemFromCart(item.inventory_id)
                              }
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                aria-label={`Decrease quantity for ${item.sku}`}
                                onClick={() =>
                                  updateItemQuantity(
                                    item.inventory_id,
                                    item.quantity - 1,
                                  )
                                }
                              >
                                <Minus className="size-3" />
                              </Button>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={item.available}
                                value={item.quantity}
                                aria-label={`Quantity for ${item.sku}`}
                                onChange={(e) =>
                                  updateItemQuantity(
                                    item.inventory_id,
                                    e.target.valueAsNumber,
                                  )
                                }
                                className="h-6 w-12 bg-background px-1 text-center text-xs tabular-nums"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                disabled={item.quantity >= item.available}
                                aria-label={`Increase quantity for ${item.sku}`}
                                onClick={() =>
                                  updateItemQuantity(
                                    item.inventory_id,
                                    item.quantity + 1,
                                  )
                                }
                              >
                                <Plus className="size-3" />
                              </Button>
                            </div>

                            <span className="text-sm font-medium tabular-nums">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </fieldset>

                {/* Payment & Submit Footer */}
                <div className="shrink-0 space-y-3.5 border-t bg-card p-5">
                  <fieldset
                    disabled={submitting || retryPending}
                    className="space-y-3.5"
                  >
                    <legend className="sr-only">Payment details</legend>
                    <fieldset className="space-y-2">
                    <legend className="text-xs font-medium text-muted-foreground">
                      Payment
                    </legend>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5">
                      {(
                        [
                          { id: "CASH", label: "Cash" },
                          { id: "BANK_TRANSFER", label: "Bank / Wallet" },
                          { id: "CARD", label: "Card" },
                        ] as const
                      ).map((method) => {
                        const active = paymentMethod === method.id;
                        return (
                          <label
                            key={method.id}
                            className={cn(
                              "cursor-pointer rounded-md px-2 py-1.5 text-center text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-ring",
                              active
                                ? "bg-background text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <input
                              type="radio"
                              name="walkin-payment-method"
                              value={method.id}
                              checked={active}
                              onChange={() => {
                                setPaymentMethod(method.id);
                                setPaymentType("");
                                setPaymentTypeTouched(false);
                                setFormError(null);
                                if (method.id !== "CASH") {
                                  setAmountTenderedInput(
                                    cartTotal > 0
                                      ? cartTotal.toFixed(2)
                                      : "0.00",
                                  );
                                  setTenderedManuallyEdited(false);
                                }
                              }}
                              className="sr-only"
                            />
                            {method.label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  {paymentMethod !== "CASH" && (
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-muted-foreground">
                        {paymentMethod === "BANK_TRANSFER"
                          ? "Provider"
                          : "Card network"}{" "}
                        <span aria-hidden="true" className="text-destructive">
                          *
                        </span>
                      </label>
                      <PaymentTypeCombobox
                        key={paymentMethod}
                        method={paymentMethod}
                        value={paymentType}
                        onChange={(val) => {
                          setPaymentType(val);
                          setFormError(null);
                        }}
                        onBlur={() => setPaymentTypeTouched(true)}
                        invalid={showPaymentTypeError}
                      />
                    </div>
                  )}

                  {paymentMethod === "CASH" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="walkin-tendered"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Cash tendered
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAmountTenderedInput(cartTotal.toFixed(2));
                              setTenderedManuallyEdited(false);
                              setFormError(null);
                            }}
                            className="rounded border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            Exact
                          </button>
                          {[100, 500, 1000].map((inc) => (
                            <button
                              key={inc}
                              type="button"
                              onClick={() => {
                                const base = Math.max(
                                  parsedTendered,
                                  cartTotal,
                                );
                                setAmountTenderedInput(
                                  (Math.ceil(base / inc) * inc || inc).toFixed(
                                    2,
                                  ),
                                );
                                setTenderedManuallyEdited(true);
                                setFormError(null);
                              }}
                              className="rounded border px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              ₱{inc}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Input
                        ref={tenderedInputRef}
                        id="walkin-tendered"
                        name="amount_tendered"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        value={amountTenderedInput}
                        aria-invalid={showTenderedShort ? "true" : "false"}
                        aria-describedby={
                          showTenderedShort
                            ? "walkin-tendered-error"
                            : undefined
                        }
                        onBlur={() => setTenderedTouched(true)}
                        onChange={(e) => {
                          setAmountTenderedInput(e.target.value);
                          setTenderedManuallyEdited(true);
                          setFormError(null);
                        }}
                        placeholder="0.00"
                        className={cn(
                          "h-10 text-right text-base font-semibold tabular-nums",
                          showTenderedShort && "border-destructive",
                        )}
                      />

                      {cartTotal > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Change</span>
                          <span
                            id={
                              showTenderedShort
                                ? "walkin-tendered-error"
                                : undefined
                            }
                            className={cn(
                              "font-semibold tabular-nums",
                              changeDue >= 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-destructive",
                            )}
                          >
                            {changeDue >= 0
                              ? formatCurrency(changeDue)
                              : `Short ${formatCurrency(Math.abs(changeDue))}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  </fieldset>

                  <div className="flex items-baseline justify-between border-t pt-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Total
                    </span>
                    <span className="text-xl font-semibold tracking-tight tabular-nums">
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>

                  <Button
                    type="submit"
                    className="h-10 w-full"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                        Processing...
                      </>
                    ) : (
                      <>
                        {retryPending
                          ? "Retry checkout"
                          : fulfillment === "DELIVERY"
                            ? "Pay & schedule"
                            : "Complete sale"}
                        {cartTotal > 0 && ` · ${formatCurrency(cartTotal)}`}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
