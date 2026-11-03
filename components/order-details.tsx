"use client";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import type { OrderDetail } from "@/schema/order";
import { formatCurrency } from "@/utils/date-util";

export function ViewOrderDetails({
  order,
  isLoading,
}: {
  order: (OrderDetail & { status?: string }) | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin" aria-label="Loading order" />
      </div>
    );
  }

  if (!order) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Unable to load this order.
      </p>
    );
  }

  const total = order.items.some((item) => item.price === null)
    ? null
    : order.items.reduce(
        (sum, item) => sum + (item.price ?? 0) * item.quantity,
        0,
      );

  const formatValue = (value?: string) =>
    value
      ? value
          .toLowerCase()
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ")
      : "Not specified";

  return (
    <div className="max-h-[65vh] space-y-5 overflow-y-auto">
      <section className="space-y-3">
        <h4 className="text-sm font-medium">Order Information</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <ViewOrderItem label="Customer" value={order.customer_name} />
          <ViewOrderItem label="Status" value={formatValue(order.status)} />
          <ViewOrderItem
            label="Delivery Type"
            value={order.delivery_type ? formatValue(order.delivery_type) : "Assigned when scheduling"}
          />
          <ViewOrderItem
            label="Payment Arrangement"
            value={formatValue(order.payment_arrangement)}
          />
          <ViewOrderItem
            label="Payment Method"
            value={formatValue(order.payment_method)}
          />
          {order.payment_type && <ViewOrderItem label="Payment Type" value={order.payment_type} />}
          <ViewOrderItem
            label="Amount Paid"
            value={formatCurrency(order.amount_paid)}
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h4 className="text-sm font-medium">Shipping destination</h4>
        <ViewOrderItem label="Recipient" value={order.shipping_recipient} />
        <ViewOrderItem label="Phone" value={order.shipping_phone} />
        <ViewOrderItem label="Address saved at checkout" value={order.shipping_address} />
      </section>
      <section className="space-y-3">
        <h4 className="text-sm font-medium">Items</h4>
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.inventory_id}>
                    <TableCell>
                      <div className="font-medium">
                        {item.product_variant_name || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.description || "—"}
                      </div>
                    </TableCell>
                    <TableCell>{item.product_variant_sku || "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {item.price === null ? "Unverified" : formatCurrency(item.price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {item.price === null
                        ? "Unverified"
                        : formatCurrency(item.price * item.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex justify-end text-sm font-semibold">
          Total: {total === null ? "Unverified" : formatCurrency(total)}
        </div>
      </section>

      {order.notes && (
        <>
          <Separator />
          <ViewOrderItem label="Notes" value={order.notes} />
        </>
      )}
    </div>
  );
}

export function ViewOrderItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">
        {value || "Not specified"}
      </p>
    </div>
  );
}
