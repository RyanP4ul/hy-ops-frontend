import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { request } from "@/components/http";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { refreshRealtimeQueries } from "@/lib/realtime";
import type { OrderTableRow } from "@/schema/order";

const bulkActions = [
  {
    path: "process",
    status: "PENDING",
    label: "Process selected",
    title: "Process selected orders",
    description: "Review the pending orders before starting processing.",
    confirmLabel: "Process",
    result: "moved to Processing",
    icon: CheckCheck,
  },
  {
    path: "delivery",
    status: "PROCESSING",
    label: "Mark selected ready",
    title: "Mark selected orders ready for scheduling",
    description: "Confirm these orders are packed. This issues their invoices and moves them to Delivery Schedules.",
    confirmLabel: "Mark ready",
    result: "marked ready for scheduling",
    icon: CalendarCheck,
  },
] as const;

type BulkAction = (typeof bulkActions)[number];
type BulkFailure = { order: OrderTableRow; message: string };

export function canSelectBulkOrder(order: OrderTableRow) {
  return order.entry_type !== "GROUP" && order.delivery_type !== "WALK_IN" &&
    bulkActions.some((action) => action.status === order.status);
}

function orderCount(count: number) {
  return `${count} ${count === 1 ? "order" : "orders"}`;
}

function orderName(order: OrderTableRow) {
  return order.product_number || `Order #${order.id}`;
}

export function BulkOrderActions({
  orders,
  disabled,
  onClear,
  onUpdated,
}: {
  orders: OrderTableRow[];
  disabled: boolean;
  onClear: () => void;
  onUpdated: (ids: number[]) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState<{
    action: BulkAction;
    orders: OrderTableRow[];
  } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<{
    updated: number;
    failures: BulkFailure[];
  } | null>(null);
  const pending = progress !== null;

  async function applyAction() {
    if (!confirmation || pending || outcome) return;

    const { action, orders } = confirmation;
    const updatedIds: number[] = [];
    const failures: BulkFailure[] = [];
    setProgress(0);

    for (const order of orders) {
      const response = await request(
        "POST",
        `/api/orders/${action.path}/${order.id}?version=${order.version}`,
      );
      if (response.ok) {
        updatedIds.push(order.id);
      } else {
        const body = await response.json().catch(() => null);
        failures.push({
          order,
          message: typeof body?.message === "string" && body.message
            ? body.message
            : "Unable to update this order. Refresh and try again.",
        });
      }
      setProgress(updatedIds.length + failures.length);
    }

    onUpdated(updatedIds);
    await refreshRealtimeQueries(queryClient, {
      type: "RESOURCE_CHANGED",
      payload: { resource: "orders" },
    });

    setProgress(null);
    if (failures.length) {
      setOutcome({ updated: updatedIds.length, failures });
    } else {
      toast.success(`${orderCount(updatedIds.length)} ${action.result}.`);
      setConfirmation(null);
    }
  }

  return (
    <Dialog
      open={confirmation !== null}
      onOpenChange={(open, event) => {
        if (open) return;
        if (pending) event.cancel();
        else setConfirmation(null);
      }}
    >
      <div className={orders.length ? "flex flex-wrap items-center gap-2 border-b bg-primary/5 px-4 py-2.5 md:px-5" : "sr-only"}>
        <span role="status" className="mr-1 text-sm font-medium">
          {orderCount(orders.length)} selected
        </span>
        {bulkActions.map((action) => {
          const eligible = orders.filter((order) => order.status === action.status);
          if (!eligible.length) return null;
          return (
            <DialogTrigger
              key={action.path}
              disabled={disabled}
              render={<Button variant="outline" size="sm" />}
              onClick={() => {
                setOutcome(null);
                setConfirmation({ action, orders: eligible });
              }}
            >
              <action.icon className="size-4" aria-hidden="true" />
              {action.label} ({eligible.length})
            </DialogTrigger>
          );
        })}
        {orders.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Clear selection
          </Button>
        )}
      </div>

      {confirmation && (
        <DialogContent showCloseButton={!pending && !outcome} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{confirmation.action.title}</DialogTitle>
            <DialogDescription>{confirmation.action.description}</DialogDescription>
          </DialogHeader>
          {outcome ? (
            <div className="space-y-2">
              <p role="alert" className="font-medium text-destructive">
                {orderCount(outcome.failures.length)} could not be updated.
                {outcome.updated > 0 && ` ${orderCount(outcome.updated)} ${confirmation.action.result}.`}
              </p>
              <ul className="max-h-60 divide-y overflow-y-auto rounded-md border" tabIndex={0} aria-label="Orders that could not be updated">
                {outcome.failures.map(({ order, message }) => (
                  <li key={order.id} className="space-y-0.5 px-3 py-2">
                    <p className="font-medium">{orderName(order)}</p>
                    <p className="text-muted-foreground">{message}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="max-h-60 divide-y overflow-y-auto rounded-md border" tabIndex={0} aria-label="Orders to update">
              {confirmation.orders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{orderName(order)}</p>
                    <p className="break-words text-xs text-muted-foreground">{order.customer_name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {order.total_quantity} {order.total_quantity === 1 ? "unit" : "units"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {pending && (
            <p role="status" className="text-sm text-muted-foreground">
              Updates finished for {progress} of {orderCount(confirmation.orders.length)}
            </p>
          )}
          <DialogFooter>
            <DialogClose disabled={pending} render={<Button variant="outline" />}>
              {outcome ? "Close" : "Cancel"}
            </DialogClose>
            {!outcome && (
              <Button type="button" disabled={pending} onClick={() => void applyAction()}>
                {pending ? "Updating…" : `${confirmation.action.confirmLabel} ${orderCount(confirmation.orders.length)}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
