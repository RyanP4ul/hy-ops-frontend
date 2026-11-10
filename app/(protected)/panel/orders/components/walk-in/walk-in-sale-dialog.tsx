"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  Minus,
  Package,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  UserCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  walkInOrderFormSchema,
  type WalkInCartItem,
  type WalkInSaleResult,
} from "@/schema/walk-in-order";
import Invoice from "../invoice";
import Link from "next/link";
import { DeliveryFields, type DeliveryDetails, type SavedDeliveryAddress } from "./delivery-fields";

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
  const { send } = useWebSocket();

  const [selectedWarehouseId, setWarehouseId] = useState<number>(-1);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [buyerMode, setBuyerMode] = useState<"GUEST" | "REGISTERED">("GUEST");
  const [customerId, setCustomerId] = useState<number | undefined>(undefined);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<"TAKEAWAY" | "DELIVERY">("TAKEAWAY");
  const [delivery, setDelivery] = useState<DeliveryDetails>({ shipping_recipient: "", shipping_phone: "", shipping_address: "" });
  const checkoutKey = useRef<string | null>(null);
  const pendingPayload = useRef<Record<string, unknown> | null>(null);
  const [retryPending, setRetryPending] = useState(false);
  const submitLock = useRef(false);
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<WalkInCartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER" | "CARD">("CASH");
  const [paymentType, setPaymentType] = useState("");
  const [enteredTenderedInput, setAmountTenderedInput] = useState<string>("");
  const [tenderedManuallyEdited, setTenderedManuallyEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<WalkInSaleResult | null>(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);

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

  const warehouseId = selectedWarehouseId > 0 ? selectedWarehouseId : warehousesQuery.data?.rows[0]?.id ?? -1;

  const catalogQuery = useQuery({
    queryKey: ["walk_in_catalog", warehouseId, catalogSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "0",
        limit: "40",
        warehouse_id: String(warehouseId),
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

  const amountTenderedInput = paymentMethod !== "CASH" || !tenderedManuallyEdited
    ? cartTotal > 0 ? cartTotal.toFixed(2) : ""
    : enteredTenderedInput;

  const parsedTendered = useMemo(() => {
    const num = Number(amountTenderedInput);
    return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) / 100 : 0;
  }, [amountTenderedInput]);

  const changeDue = useMemo(() => {
    return Math.round((parsedTendered - cartTotal) * 100) / 100;
  }, [parsedTendered, cartTotal]);

  function changeFulfillment(next: "TAKEAWAY" | "DELIVERY") {
    if (next === fulfillment) return;
    if (buyerMode === "GUEST") {
      if (next === "TAKEAWAY") {
        setWalkInName(delivery.shipping_recipient);
        setWalkInPhone(delivery.shipping_phone);
      } else {
        setDelivery(current => ({ ...current, shipping_recipient: walkInName, shipping_phone: walkInPhone }));
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
    setDelivery({ shipping_recipient: next === "GUEST" ? walkInName : "", shipping_phone: next === "GUEST" ? walkInPhone : "", shipping_address: "" });
  }

  function resetSaleState() {
    checkoutKey.current = null;
    pendingPayload.current = null;
    setRetryPending(false);
    setFulfillment("TAKEAWAY");
    setDelivery({ shipping_recipient: "", shipping_phone: "", shipping_address: "" });
    setCatalogSearch("");
    setBuyerMode("GUEST");
    setCustomerId(undefined);
    setWalkInName("");
    setWalkInPhone("");
    setNotes("");
    setCart([]);
    setPaymentMethod("CASH");
    setPaymentType("");
    setAmountTenderedInput("");
    setTenderedManuallyEdited(false);
    setFormError(null);
    setCompletedSale(null);
    setShowInvoicePreview(false);
  }

  function addItemToCart(row: InventoryCatalogRow) {
    const available = Math.max(0, row.quantity - row.reserved);
    const price = Number(row.price ?? 0);
    if (available <= 0) {
      toast.error(`${row.sku ?? "Item"} is out of stock in this warehouse.`);
      return;
    }

    setFormError(null);
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.inventory_id === row.id);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex]!;
        if (existing.quantity + 1 > available) {
          toast.error(`Only ${available} units of ${existing.sku} available.`);
          return prev;
        }
        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1, available } : item,
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
        const clamped = Math.max(1, Math.min(item.available, Math.floor(nextQuantity || 1)));
        return { ...item, quantity: clamped };
      }),
    );
  }

  function removeItemFromCart(inventoryId: number) {
    setFormError(null);
    setCart((prev) => prev.filter((item) => item.inventory_id !== inventoryId));
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const rows = catalogQuery.data ?? [];
    if (!rows.length) return;
    const normalized = catalogSearch.trim().toLowerCase();
    const exactSku = rows.find((r) => (r.sku ?? "").toLowerCase() === normalized);
    const candidate = exactSku ?? rows.find((r) => r.quantity - r.reserved > 0) ?? rows[0];
    if (candidate) {
      addItemToCart(candidate);
    }
  }

  async function handleCompleteSale(e: React.FormEvent) {
    e.preventDefault();
    if (submitLock.current) return;
    setFormError(null);

    const effectiveTendered = paymentMethod === "CASH" ? parsedTendered : cartTotal;

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
      payment_type: paymentMethod === "CASH" ? undefined : paymentType.trim(),
      amount_tendered: effectiveTendered,
      items: cart,
    });

    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      setFormError(firstIssue?.message ?? "Please review the counter sale details.");
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
          validation.data.buyer_mode === "GUEST" && validation.data.walk_in_name?.trim()
            ? validation.data.walk_in_name.trim()
            : undefined,
        walk_in_phone:
          validation.data.buyer_mode === "GUEST" && validation.data.walk_in_phone?.trim()
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
        setFormError(body?.message || "Unable to complete walk-in sale.");
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

      toast.success(saleResult.message || `Walk-in order ${saleResult.order_number} completed.`);
    } catch {
      setFormError("Unable to confirm checkout. Retry this same sale to recover its payment result safely.");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const warehouses = warehousesQuery.data?.rows ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitLock.current) return;
        if (!nextOpen && !pendingPayload.current) resetSaleState();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[92vh] scroll-pb-20 overflow-y-auto sm:max-w-5xl">
        {completedSale ? (
          <div className="space-y-6 py-2">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-6" />
                </span>
                <div>
                  <DialogTitle className="text-xl">
                    {completedSale.delivery_type === "INTERNAL" ? "Paid - awaiting delivery scheduling" : "Counter Sale Completed"} - {completedSale.order_number || completedSale.product_number}
                  </DialogTitle>
                  <DialogDescription>
                    {completedSale.delivery_type === "INTERNAL" ? "Payment is recorded and stock is reserved. Assign a vehicle and driver in delivery scheduling." : "Stock has been deducted immediately, payment is recorded as Paid, and the invoice is Issued."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {completedSale.delivery_type === "INTERNAL" && <Link className="inline-flex text-sm font-medium underline" href="/panel/delivery-schedules" onClick={() => { resetSaleState(); onOpenChange(false); }}>Open delivery scheduling</Link>}
            <div className="grid gap-4 rounded-xl border bg-muted/25 p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Paid
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {formatCurrency(completedSale.total)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Amount Tendered
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatCurrency(completedSale.amount_tendered)}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Change Due
                </p>
                <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(completedSale.change_due)}
                </p>
              </div>
            </div>

            {showInvoicePreview ? (
              <div className="rounded-xl border bg-card p-4">
                <Invoice orderId={completedSale.id} />
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <ReceiptText className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Official Receipt & Invoice Ready
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Buyer: {completedSale.customer_name || "Walk-in Customer"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInvoicePreview(true)}
                >
                  <Printer className="mr-1.5 size-4" />
                  Print / Download Receipt
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetSaleState();
                  onOpenChange(false);
                }}
              >
                Close
              </Button>
              <Button type="button" onClick={resetSaleState}>
                <RotateCcw className="mr-1.5 size-4" />
                New Walk-in Sale
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCompleteSale} className="min-w-0 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Store className="size-5" />
                </span>
                <div>
                  <DialogTitle className="text-lg sm:text-xl">
                    Walk-in Counter Sale
                  </DialogTitle>
                  <DialogDescription>
                    Take full payment at the counter. Choose immediate takeaway or delivery using a company vehicle.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {formError && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {formError}
              </div>
            )}

            {retryPending && <p role="status" className="text-sm">Checkout details are held while payment is being confirmed. Use Retry checkout to recover the same sale.</p>}
            <fieldset disabled={submitting || retryPending} className={submitting || retryPending ? "contents pointer-events-none" : "contents"}>
            <section className="space-y-3" aria-labelledby="walkin-fulfillment-label">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="walkin-fulfillment-label" className="text-sm font-semibold">How will the customer receive this order?</h3>
                <span className="text-xs text-muted-foreground">{cart.reduce((sum, item) => sum + item.quantity, 0)} total units</span>
              </div>
              <div role="radiogroup" aria-labelledby="walkin-fulfillment-label" className="grid gap-3 sm:grid-cols-2">
                {([
                  { value: "TAKEAWAY", title: "Take away now", description: "Pay at the counter and take the items home.", icon: Store },
                  { value: "DELIVERY", title: "Company vehicle delivery", description: "Pay now. Assign a vehicle and driver after checkout.", icon: Truck },
                ] as const).map(option => <label key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-ring ${fulfillment === option.value ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/40"}`}>
                  <input type="radio" name="walkin-fulfillment" aria-label={option.title} value={option.value}
                    checked={fulfillment === option.value} onChange={() => changeFulfillment(option.value)} className="mt-1 accent-primary" />
                  <option.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="space-y-1">
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">{option.description}</span>
                  </span>
                </label>)}
              </div>
            </section>
            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
              {/* Left Pane: Warehouse, Catalog Picker, Buyer */}
              <div className="min-w-0 space-y-4">
                {/* Warehouse & Buyer Mode */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Warehouse <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={warehouseId > 0 ? String(warehouseId) : ""}
                      disabled={warehouses.length <= 1 || submitting}
                      onValueChange={(val) => {
                        const nextId = Number(val);
                        if (nextId && nextId !== warehouseId) {
                          setWarehouseId(nextId);
                          setCart([]);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select warehouse">
                          {warehouses.find((w) => w.id === warehouseId)?.name ?? "Select warehouse"}
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
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Buyer Type
                    </label>
                    <div className="grid h-9 grid-cols-2 rounded-lg border bg-muted/40 p-0.5">
                      <button
                        type="button"
                        onClick={() => changeBuyerMode("GUEST")}
                        aria-pressed={buyerMode === "GUEST"}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
                          buyerMode === "GUEST"
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <UserRound className="size-3.5" />
                        Walk-in Guest
                      </button>
                      <button
                        type="button"
                        onClick={() => changeBuyerMode("REGISTERED")}
                        aria-pressed={buyerMode === "REGISTERED"}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
                          buyerMode === "REGISTERED"
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <UserCheck className="size-3.5" />
                        Registered
                      </button>
                    </div>
                  </div>
                </div>

                {/* Buyer Details */}
                {buyerMode === "GUEST" && fulfillment === "TAKEAWAY" && (
                  <div className="grid gap-3 rounded-xl border bg-muted/15 p-3.5 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="walkin-name" className="text-xs font-medium">
                        Buyer Name <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <Input
                        id="walkin-name"
                        value={walkInName}
                        onChange={(e) => { setWalkInName(e.target.value); setDelivery(current => ({ ...current, shipping_recipient: e.target.value })); }}
                        placeholder="Defaults to Walk-in Customer"
                        maxLength={60}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="walkin-phone" className="text-xs font-medium">
                        Contact Phone <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <Input
                        id="walkin-phone"
                        value={walkInPhone}
                        onChange={(e) => { setWalkInPhone(e.target.value); setDelivery(current => ({ ...current, shipping_phone: e.target.value })); }}
                        placeholder="e.g. 0917-000-0000"
                        maxLength={20}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
                {buyerMode === "REGISTERED" && (
                  <div className="space-y-1.5 rounded-xl border bg-muted/15 p-3.5">
                    <label className="text-xs font-medium">
                      Registered Customer <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={customerId ? String(customerId) : ""}
                      onValueChange={(val) => {
                        if (Number(val) === customerId) return;
                        const buyer = customersQuery.data?.rows.find(customer => customer.id === Number(val));
                        setCustomerId(Number(val));
                        setDelivery({ shipping_recipient: buyer?.name ?? "", shipping_phone: buyer?.phone_number ?? "", shipping_address: "" });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a registered customer">
                          {customersQuery.data?.rows.find((c) => c.id === customerId)?.name ??
                            "Choose a registered customer"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {(customersQuery.data?.rows ?? []).map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name} ({c.company_name})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Product / SKU Search & Catalog List */}
                <div className="space-y-2.5 rounded-xl border bg-card p-3.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="walkin-sku-search" className="text-xs font-semibold">
                      Add Products from Warehouse Stock
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      Press Enter to quick-add SKU
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="walkin-sku-search"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Search or scan SKU / product name..."
                      className="pl-8 text-sm"
                    />
                  </div>

                  <div className="max-h-60 divide-y overflow-y-auto rounded-lg border bg-background">
                    {catalogQuery.isPending ? (
                      <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Loading warehouse stock...
                      </div>
                    ) : !(catalogQuery.data ?? []).length ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        No matching products found in this warehouse.
                      </div>
                    ) : (
                      (catalogQuery.data ?? []).map((row) => {
                        const available = Math.max(0, row.quantity - row.reserved);
                        const inCart = cart.find((c) => c.inventory_id === row.id);
                        const price = Number(row.price ?? 0);
                        return (
                          <div
                            key={row.id}
                            className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs hover:bg-muted/40"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-semibold text-foreground">
                                  {row.product_name || row.sku}
                                </span>
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {row.sku}
                                </Badge>
                              </div>
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                {row.description || "Standard variant"} ·{" "}
                                <span
                                  className={
                                    available > 0
                                      ? "font-medium text-emerald-600 dark:text-emerald-400"
                                      : "font-medium text-destructive"
                                  }
                                >
                                  {available} available
                                </span>
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2.5">
                              <span className="font-semibold tabular-nums">
                                {formatCurrency(price)}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant={inCart ? "secondary" : "default"}
                                className="h-7 px-2.5 text-xs"
                                disabled={available <= 0 || (inCart ? inCart.quantity >= available : false)}
                                onClick={() => addItemToCart(row)}
                              >
                                <Plus className="mr-1 size-3" />
                                {inCart ? `In Cart (${inCart.quantity})` : "Add"}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {fulfillment === "DELIVERY" && <DeliveryFields value={delivery} onChange={setDelivery}
                  addresses={buyerMode === "REGISTERED" ? customersQuery.data?.rows.find(customer => customer.id === customerId)?.addresses : []} />}

                {/* Optional Notes */}
                <div className="space-y-1">
                  <label htmlFor="walkin-notes" className="text-xs font-medium text-muted-foreground">
                    Order notes (optional)
                  </label>
                  <Textarea
                    id="walkin-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add receipt remarks or serial numbers..."
                    rows={2}
                    maxLength={2000}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Right Pane: Cart & Counter Payment */}
              <div className="flex h-fit min-w-0 flex-col rounded-2xl border bg-muted/15 p-4 lg:sticky lg:top-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="size-4 text-primary" />
                      <h3 className="text-sm font-semibold">Order summary</h3>
                    </div>
                    <Badge variant="secondary">
                      {cart.reduce((sum, i) => sum + i.quantity, 0)} units
                    </Badge>
                  </div>

                  {!cart.length ? (
                    <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed bg-background/60 p-6 text-center">
                      <Package className="mb-2 size-7 text-muted-foreground/50" />
                      <p className="text-xs font-medium">Cart is empty</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Select products from the left panel to start the sale.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-56 divide-y overflow-y-auto rounded-xl border bg-background px-3">
                      {cart.map((item) => (
                        <div
                          key={item.inventory_id}
                          className="flex items-center justify-between gap-2 py-2.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{item.product_name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.sku} · {formatCurrency(item.price)} each
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-6"
                              aria-label={`Decrease quantity for ${item.sku}`}
                              onClick={() => updateItemQuantity(item.inventory_id, item.quantity - 1)}
                            >
                              <Minus className="size-3" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              max={item.available}
                              value={item.quantity}
                              aria-label={`Quantity for ${item.sku}`}
                              onChange={(e) =>
                                updateItemQuantity(item.inventory_id, e.target.valueAsNumber)
                              }
                              className="h-6 w-12 px-1 text-center text-xs tabular-nums"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-6"
                              disabled={item.quantity >= item.available}
                              aria-label={`Increase quantity for ${item.sku}`}
                              onClick={() => updateItemQuantity(item.inventory_id, item.quantity + 1)}
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>

                          <div className="w-20 text-right font-semibold tabular-nums">
                            {formatCurrency(item.price * item.quantity)}
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${item.sku}`}
                            onClick={() => removeItemFromCart(item.inventory_id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment & Totals Footer */}
                <div className="mt-4 space-y-3.5 border-t pt-3.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Due (Fully Paid)
                    </span>
                    <span className="text-2xl font-extrabold tracking-tight tabular-nums">
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>

                  <p className="rounded-lg bg-background p-3 text-xs leading-relaxed text-muted-foreground">
                    {fulfillment === "DELIVERY" ? "Full payment is collected now. Stock stays reserved until the vehicle is dispatched." : "Full payment completes the sale and deducts the items from stock."}
                  </p>
                  {/* Payment Method Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: "CASH", label: "Cash" },
                          { id: "BANK_TRANSFER", label: "Bank / E-Wallet" },
                          { id: "CARD", label: "Card" },
                        ] as const
                      ).map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(method.id);
                            setPaymentType("");
                            if (method.id !== "CASH") {
                              setAmountTenderedInput(cartTotal > 0 ? cartTotal.toFixed(2) : "0.00");
                              setTenderedManuallyEdited(false);
                            }
                          }}
                          className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-all ${
                            paymentMethod === method.id
                              ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                              : "bg-background text-foreground hover:bg-muted"
                          }`}
                        >
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod !== "CASH" && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {paymentMethod === "BANK_TRANSFER" ? "Bank / E-Wallet Provider" : "Card Network"}{" "}
                        <span className="text-destructive">*</span>
                      </label>
                      <PaymentTypeCombobox
                        key={paymentMethod}
                        method={paymentMethod}
                        value={paymentType}
                        onChange={setPaymentType}
                        onBlur={() => {}}
                        invalid={false}
                      />
                    </div>
                  )}

                  {paymentMethod === "CASH" && (
                    <div className="space-y-2 rounded-xl border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="walkin-tendered" className="text-xs font-medium">
                          Cash Tendered <span className="text-destructive">*</span>
                        </label>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAmountTenderedInput(cartTotal.toFixed(2));
                              setTenderedManuallyEdited(false);
                            }}
                            className="rounded border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium hover:bg-muted"
                          >
                            Exact
                          </button>
                          {[100, 500, 1000].map((inc) => (
                            <button
                              key={inc}
                              type="button"
                              onClick={() => {
                                const base = Math.max(parsedTendered, cartTotal);
                                setAmountTenderedInput((Math.ceil(base / inc) * inc || inc).toFixed(2));
                                setTenderedManuallyEdited(true);
                              }}
                              className="rounded border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium hover:bg-muted"
                            >
                              ₱{inc}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Input
                        id="walkin-tendered"
                        type="number"
                        step="0.01"
                        min={0}
                        value={amountTenderedInput}
                        onChange={(e) => {
                          setAmountTenderedInput(e.target.value);
                          setTenderedManuallyEdited(true);
                        }}
                        placeholder="0.00"
                        className="h-9 text-right text-base font-semibold tabular-nums"
                      />

                      <div className="flex items-center justify-between border-t pt-2 text-xs">
                        <span className="font-medium text-muted-foreground">Change Due</span>
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            changeDue >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive"
                          }`}
                        >
                          {changeDue >= 0
                            ? formatCurrency(changeDue)
                            : `Short by ${formatCurrency(Math.abs(changeDue))}`}
                        </span>
                      </div>
                    </div>
                  )}


                </div>
              </div>
            </div>
            </fieldset>
            <Button
                    type="submit"
                    className="sticky bottom-0 z-10 h-auto min-h-10 w-full whitespace-normal py-3 shadow-lg"
                    disabled={submitting || cart.length === 0}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Completing Counter Sale...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 size-4" />
                        {retryPending ? "Retry checkout" : fulfillment === "DELIVERY" ? "Pay and send to scheduling" : "Complete Sale"} ({formatCurrency(cartTotal)})
                      </>
                    )}
                  </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
