"use client";

import type { ReactNode } from "react";
import { Check, Layers, Link2, Loader2, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatOrderGroupCode, type OrderDetail } from "@/schema/order";
import { formatCurrency, parseLocalDateTime } from "@/utils/date-util";

export const ORDER_PROCESS_STEPS = [
  { key: "PENDING", label: "Pending" },
  { key: "PROCESSING", label: "Processing" },
  { key: "SCHEDULING", label: "Scheduling" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "COMPLETED", label: "Completed" },
] as const;

export function formatOrderLabel(value?: string | null): string {
  if (!value) return "—";
  const overrides: Record<string, string> = {
    PENDING: "Pending",
    PROCESSING: "Processing",
    SCHEDULING: "Scheduling",
    SCHEDULED: "Scheduled",
    IN_TRANSIT: "In Transit",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    INTERNAL: "Company Delivery",
    PICKUP: "Customer Pickup",
    LALAMOVE: "Lalamove",
    WALK_IN: "Walk-in Counter",
    NET_30: "Net 30",
    FULLY_PAID: "Fully Paid",
    PARTIALLY_PAID: "Partially Paid",
    PAY_ON_DELIVERY: "Pay on Delivery",
    BANK_TRANSFER: "Bank Transfer",
    CASH: "Cash",
    CHEQUE: "Cheque",
    CHECK: "Check",
    E_WALLET: "E-Wallet",
    GCASH: "GCash",
    UNPAID: "Unpaid",
    PAID: "Paid",
    UNVERIFIED: "Unverified",
  };
  if (overrides[value]) return overrides[value];
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getOrderStatusBadgeClass(status?: string | null): string {
  switch (status) {
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
    case "PROCESSING":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";
    case "SCHEDULING":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300";
    case "SCHEDULED":
      return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300";
    case "IN_TRANSIT":
      return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300";
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function getOrderPaymentSummary(order: Pick<OrderDetail, "items" | "amount_paid">) {
  const total = order.items.some((item) => item.price === null)
    ? null
    : order.items.reduce(
        (sum, item) => sum + (item.price ?? 0) * item.quantity,
        0,
      );
  const amountPaid = order.amount_paid ?? 0;
  const balanceDue = total === null ? null : Math.max(0, total - amountPaid);
  const paymentStatus =
    total === null
      ? "UNVERIFIED"
      : amountPaid <= 0
        ? "UNPAID"
        : amountPaid >= total
          ? "PAID"
          : "PARTIALLY_PAID";

  return { total, amountPaid, balanceDue, paymentStatus };
}

function formatDateTime(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatScheduledDeparture(date?: string | null, time?: string | null): string {
  if (!date) return "—";
  if (time) {
    const parsed = parseLocalDateTime(date, time);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(parsed);
    }
  }
  return date;
}

export function OrderProcessStepper({ status }: { status?: string | null }) {
  if (!status) return null;

  if (status === "CANCELLED") {
    return (
      <div
        role="status"
        className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/80 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/80 dark:bg-red-950/40 dark:text-red-300"
      >
        <XCircle className="size-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">Order cancelled</span>
        <span className="text-xs opacity-85">
          Reserved inventory has been released.
        </span>
      </div>
    );
  }

  const currentIndex = ORDER_PROCESS_STEPS.findIndex(
    (step) => step.key === status,
  );
  const isAllDone = status === "COMPLETED";

  return (
    <nav aria-label="Order progress" className="w-full">
      <ol className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-6 sm:gap-x-0">
        {ORDER_PROCESS_STEPS.map((step, index) => {
          const isCompleted = isAllDone || (currentIndex >= 0 && index < currentIndex);
          const isCurrent = !isAllDone && index === currentIndex;
          const isReached = isCompleted || isCurrent;
          const isLast = index === ORDER_PROCESS_STEPS.length - 1;

          return (
            <li
              key={step.key}
              aria-current={isCurrent ? "step" : undefined}
              className="relative flex flex-col items-center text-center"
            >
              {/* Connecting line on sm+ screens */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute top-3 left-[calc(50%+14px)] hidden h-0.5 w-[calc(100%-28px)] sm:block ${
                    isAllDone || (currentIndex >= 0 && index < currentIndex)
                      ? "bg-emerald-500"
                      : "bg-border"
                  }`}
                />
              )}

              <span
                aria-hidden="true"
                className={`relative z-10 flex size-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                  isCompleted
                    ? "bg-emerald-600 text-white dark:bg-emerald-500"
                    : isCurrent
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : "border border-border bg-background text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="size-3.5 stroke-[2.5]" />
                ) : (
                  index + 1
                )}
              </span>

              <span
                className={`mt-1.5 text-[11px] leading-tight ${
                  isCurrent
                    ? "font-semibold text-foreground"
                    : isReached
                      ? "font-medium text-foreground/85"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function OrderDetailsDrawer({
  open,
  onOpenChange,
  title,
  order,
  isLoading,
  feedback,
  onSelectOrder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  order: (OrderDetail & { status?: string }) | null;
  isLoading: boolean;
  feedback?: ReactNode;
  onSelectOrder?: (orderId: number) => void;
}) {
  const displayTitle = order?.order_number || title || "Order Details";
  const createdLabel = formatDateTime(order?.created_at);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="right"
    >
      <DrawerContent className="bg-background data-[swipe-axis=x]:[--drawer-content-width:100vw] data-[swipe-axis=x]:sm:[--drawer-content-width:min(92vw,52rem)] data-[swipe-axis=x]:lg:[--drawer-content-width:min(85vw,58rem)]">
        <DrawerHeader className="border-b px-5 py-4 text-left sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <DrawerTitle className="text-lg font-semibold tracking-tight">
                  {displayTitle}
                </DrawerTitle>
                {order?.status && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getOrderStatusBadgeClass(order.status)}`}
                  >
                    {formatOrderLabel(order.status)}
                  </span>
                )}
                {(order?.sales_channel === "WALK_IN" ||
                  order?.delivery_type === "WALK_IN") && (
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    Walk-in
                  </Badge>
                )}
              </div>
              <DrawerDescription className="text-xs text-muted-foreground">
                {[
                  createdLabel ? `Placed ${createdLabel}` : null,
                  order?.warehouse_name ? order.warehouse_name : null,
                  order?.order_group_number
                    ? `${formatOrderGroupCode(order.order_group_number)} (${order.order_group_position} of ${order.order_group_size})`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Order overview and item breakdown."}
              </DrawerDescription>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {order?.tracking_token && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}/track/${order.tracking_token}`;
                    void navigator.clipboard
                      ?.writeText(url)
                      .then(() => toast.success("Customer tracking link copied"))
                      .catch(() => toast.info(url));
                  }}
                >
                  <Link2 className="mr-1.5 size-3.5" aria-hidden="true" />
                  Copy tracking link
                </Button>
              )}
              <DrawerClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close"
                    className="shrink-0"
                  />
                }
              >
                <X className="size-4" aria-hidden="true" />
              </DrawerClose>
            </div>
          </div>
        </DrawerHeader>

        {order?.status && (
          <div className="border-b bg-muted/25 px-5 py-3.5 sm:px-6">
            <OrderProcessStepper status={order.status} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {feedback}
          <ViewOrderDetails
            order={order}
            isLoading={isLoading}
            hideTopStepper
            onSelectOrder={onSelectOrder}
          />
        </div>

        <DrawerFooter className="flex-row items-center justify-end border-t bg-background px-5 py-3.5 sm:px-6">
          <DrawerClose
            render={
              <Button type="button" variant="outline">
                Close
              </Button>
            }
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function ViewOrderDetails({
  order,
  isLoading,
  hideTopStepper = false,
  onSelectOrder,
}: {
  order: (OrderDetail & { status?: string }) | null;
  isLoading: boolean;
  hideTopStepper?: boolean;
  onSelectOrder?: (orderId: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading order" />
      </div>
    );
  }

  if (!order) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Unable to load this order.
      </p>
    );
  }

  const { total, amountPaid, balanceDue, paymentStatus } =
    getOrderPaymentSummary(order);
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const isWalkInCounter = order.delivery_type === "WALK_IN";

  const paymentBadgeClass =
    paymentStatus === "PAID"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
      : paymentStatus === "PARTIALLY_PAID"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        : paymentStatus === "UNPAID"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          : "border-border bg-muted text-muted-foreground";

  const walkInChange =
    order.walk_in_amount_tendered !== null &&
    order.walk_in_amount_tendered !== undefined &&
    total !== null
      ? Math.max(0, order.walk_in_amount_tendered - total)
      : null;

  return (
    <div className="space-y-5">
      {!hideTopStepper && order.status && (
        <div className="rounded-lg border bg-muted/25 p-3.5">
          <OrderProcessStepper status={order.status} />
        </div>
      )}

      {/* Key Metrics Summary */}
      <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3.5 sm:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Order Total</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {total === null ? "Unverified" : formatCurrency(total)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Payment</dt>
          <dd className="mt-0.5">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${paymentBadgeClass}`}
            >
              {formatOrderLabel(paymentStatus)}
            </span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Warehouse</dt>
          <dd className="mt-0.5 truncate text-sm font-medium">
            {order.warehouse_name || "—"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Fulfillment</dt>
          <dd className="mt-0.5 truncate text-sm font-medium">
            {order.delivery_type
              ? formatOrderLabel(order.delivery_type)
              : "To be scheduled"}
          </dd>
        </div>
      </dl>

      {/* Customer & Destination */}
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="space-y-2.5 rounded-lg border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Customer
          </h3>
          <dl className="space-y-1.5 text-sm">
            <div>
              <dt className="sr-only">Name</dt>
              <dd className="font-medium text-foreground">
                {order.customer_name}
              </dd>
            </div>
            {order.customer_company && (
              <div>
                <dt className="sr-only">Company</dt>
                <dd className="text-xs text-muted-foreground">
                  {order.customer_company}
                </dd>
              </div>
            )}
            {order.customer_phone && (
              <div className="flex justify-between gap-2 pt-1 text-xs">
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium">{order.customer_phone}</dd>
              </div>
            )}
            {order.customer_email && (
              <div className="flex justify-between gap-2 text-xs">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate font-medium">{order.customer_email}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="space-y-2.5 rounded-lg border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isWalkInCounter ? "Counter Fulfillment" : "Shipping Destination"}
          </h3>
          <dl className="space-y-1.5 text-sm">
            {order.shipping_recipient && (
              <div>
                <dt className="sr-only">Recipient</dt>
                <dd className="font-medium text-foreground">
                  {order.shipping_recipient}
                </dd>
              </div>
            )}
            {order.shipping_phone && (
              <div>
                <dt className="sr-only">Shipping phone</dt>
                <dd className="text-xs text-muted-foreground">
                  {order.shipping_phone}
                </dd>
              </div>
            )}
            <div>
              <dt className="sr-only">Address</dt>
              <dd className="pt-0.5 text-xs leading-relaxed text-muted-foreground">
                {order.shipping_address || "Address unavailable"}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Delivery Assignment (only when scheduled/assigned) */}
      {order.delivery && (
        <section className="space-y-2.5 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Delivery Schedule
            </h3>
            <span className="text-xs font-medium text-muted-foreground">
              Run #{order.delivery.delivery_id} ·{" "}
              {formatOrderLabel(order.delivery.delivery_status)}
            </span>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <ViewOrderItem
              label="Departure"
              value={formatScheduledDeparture(
                order.delivery.scheduled_date,
                order.delivery.departure_time,
              )}
            />
            <ViewOrderItem
              label="Driver"
              value={order.delivery.driver_name || "Unassigned"}
            />
            <ViewOrderItem
              label="Vehicle"
              value={
                order.delivery.vehicle_plate
                  ? `${order.delivery.vehicle_plate}${order.delivery.vehicle_type ? ` (${formatOrderLabel(order.delivery.vehicle_type)})` : ""}`
                  : "Unassigned"
              }
            />
          </dl>
          {order.delivery.delivered_at && (
            <p className="border-t pt-2 text-xs text-emerald-700 dark:text-emerald-400">
              Delivered on {formatDateTime(order.delivery.delivered_at)}
            </p>
          )}
        </section>
      )}

      {/* Order Items */}
      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Order Items
          </h3>
          <span className="text-xs text-muted-foreground">
            {order.items.length} {order.items.length === 1 ? "item" : "items"} ·{" "}
            {totalUnits} {totalUnits === 1 ? "unit" : "units"}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead scope="col">Item</TableHead>
                  <TableHead scope="col">SKU</TableHead>
                  <TableHead scope="col" className="text-right">
                    Unit Price
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Qty
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => {
                  const showProductHeading =
                    item.product_name &&
                    item.product_name !== item.product_variant_name;
                  return (
                    <TableRow key={item.inventory_id}>
                      <TableCell className="max-w-[220px] whitespace-normal">
                        {showProductHeading && (
                          <div className="text-xs text-muted-foreground">
                            {item.product_name}
                          </div>
                        )}
                        <div className="font-medium">
                          {item.product_variant_name || "—"}
                        </div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.product_variant_sku || "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {item.price === null
                          ? "Unverified"
                          : formatCurrency(item.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                        {item.price === null
                          ? "Unverified"
                          : formatCurrency(item.price * item.quantity)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-1.5 border-t bg-muted/15 px-4 py-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Order Total</span>
              <span className="font-semibold tabular-nums">
                {total === null ? "Unverified" : formatCurrency(total)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(amountPaid)}
              </span>
            </div>
            {walkInChange !== null && order.walk_in_amount_tendered !== null && (
              <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                <span>
                  Tendered ({formatCurrency(order.walk_in_amount_tendered)})
                </span>
                <span className="tabular-nums">
                  Change: {formatCurrency(walkInChange)}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t pt-1.5 text-sm font-semibold">
              <span>Balance Due</span>
              <span
                className={`tabular-nums ${
                  balanceDue === 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : ""
                }`}
              >
                {balanceDue === null
                  ? "Unverified"
                  : formatCurrency(balanceDue)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Information */}
      <section className="space-y-2.5 rounded-lg border p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Payment Information
        </h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ViewOrderItem
            label="Terms"
            value={formatOrderLabel(order.payment_arrangement)}
          />
          <ViewOrderItem
            label="Method"
            value={
              order.payment_method
                ? `${formatOrderLabel(order.payment_method)}${order.payment_type ? ` (${order.payment_type})` : ""}`
                : "Not recorded"
            }
          />
          {order.invoice_number && (
            <ViewOrderItem label="Invoice No." value={order.invoice_number} />
          )}
        </dl>

        {order.combined_payment && (
          <div className="mt-2 rounded-md border bg-muted/25 p-3 text-xs space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2 font-medium text-foreground">
              <span>
                Combined Payment {order.combined_payment.payment_number}
              </span>
              <span className="tabular-nums">
                Allocated:{" "}
                {formatCurrency(order.combined_payment.allocated_amount)} of{" "}
                {formatCurrency(order.combined_payment.amount)}
              </span>
            </div>
            {order.combined_payment.reference_number && (
              <p className="text-muted-foreground">
                Reference: {order.combined_payment.reference_number}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Related Orders in Group */}
      {order.order_group_number &&
        order.group_members &&
        order.group_members.length > 1 && (
          <section className="space-y-2.5 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Order Group
                </h3>
                <span
                  className="font-mono text-xs text-muted-foreground"
                  title={order.order_group_number}
                >
                  {formatOrderGroupCode(order.order_group_number)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {order.group_members.length} linked orders
              </span>
            </div>
            <ul className="divide-y rounded-md border">
              {order.group_members.map((member) => {
                const isCurrent = member.id === order.id;
                const rowContent = (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {member.order_number}
                        </span>
                        {member.order_group_position != null && (
                          <span className="text-[11px] text-muted-foreground">
                            #{member.order_group_position} of{" "}
                            {order.group_members!.length}
                          </span>
                        )}
                        {isCurrent && (
                          <Badge variant="secondary" className="text-[10px]">
                            Viewing
                          </Badge>
                        )}
                      </div>
                      {member.shipping_address && (
                        <p className="truncate text-muted-foreground">
                          {member.shipping_address}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getOrderStatusBadgeClass(member.status)}`}
                      >
                        {formatOrderLabel(member.status)}
                      </span>
                      <span className="min-w-16 text-right font-medium tabular-nums">
                        {member.total === null
                          ? "Unverified"
                          : formatCurrency(member.total)}
                      </span>
                    </div>
                  </div>
                );

                return (
                  <li
                    key={member.id}
                    className={isCurrent ? "bg-muted/35" : undefined}
                  >
                    {onSelectOrder && !isCurrent ? (
                      <button
                        type="button"
                        onClick={() => onSelectOrder(member.id)}
                        className="w-full cursor-pointer text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        {rowContent}
                      </button>
                    ) : (
                      rowContent
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

      {/* Split Shipments / Staging */}
      {(order.staging_bay ||
        order.staged_at ||
        order.parent_order_number ||
        (order.split_children && order.split_children.length > 0)) && (
        <section className="space-y-2.5 rounded-lg border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Warehouse Staging &amp; Shipments
          </h3>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {order.staging_bay && (
              <ViewOrderItem label="Staging Bay" value={order.staging_bay} />
            )}
            {order.staged_at && (
              <ViewOrderItem
                label="Verified Staged"
                value={formatDateTime(order.staged_at)}
              />
            )}
            {order.parent_order_number && (
              <ViewOrderItem
                label="Split From"
                value={order.parent_order_number}
              />
            )}
          </dl>
          {order.split_reason && (
            <p className="text-xs text-muted-foreground">
              Split note: {order.split_reason}
            </p>
          )}
          {order.split_children && order.split_children.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Split Shipments ({order.split_children.length})
              </p>
              <ul className="divide-y rounded-md border">
                {order.split_children.map((child) => (
                  <li
                    key={child.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <button
                      type="button"
                      disabled={!onSelectOrder}
                      onClick={() => onSelectOrder?.(child.id)}
                      className="font-medium text-foreground hover:underline disabled:no-underline"
                    >
                      {child.order_number} ({child.total_quantity} units)
                    </button>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getOrderStatusBadgeClass(child.status)}`}
                    >
                      {formatOrderLabel(child.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Notes */}
      {order.notes?.trim() && (
        <section className="space-y-1.5 rounded-lg border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {order.notes}
          </p>
        </section>
      )}
    </div>
  );
}

export function ViewOrderItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">
        {value || "—"}
      </dd>
    </div>
  );
}
