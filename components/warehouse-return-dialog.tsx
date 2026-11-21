"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { request } from "@/components/http";
import { useSetting } from "@/components/providers/setting-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type CodCollectionInput = {
  paymentNumber: string;
  amountReceived: number;
  version: number;
};

type ReturnSummary = {
  deliveryId: number;
  failedStops: {
    stopId: number;
    orderNumber: string;
    customerName: string;
    reason: string | null;
  }[];
  collectedPickups: {
    id: number;
    orderNumber: string;
    customer: string;
  }[];
  codOrders: {
    orderId: number;
    orderNumber: string;
    customerName: string;
    paymentNumber: string;
    paymentVersion: number;
    paymentStatus: string;
    orderTotal: string | null;
    amountPaid: string;
    remainingAmount: string | null;
  }[];
};

const php = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export function WarehouseReturnDialog({
  open,
  onOpenChange,
  busy,
  onConfirm,
  error,
  label = "Confirm warehouse return",
  showTrigger = true,
  warehouseName,
  deliveryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onConfirm: (codCollections?: CodCollectionInput[]) => Promise<void>;
  error?: string | null;
  label?: string;
  showTrigger?: boolean;
  warehouseName?: string;
  deliveryId?: number;
}) {
  const { settingQuery } = useSetting();
  const radius =
    settingQuery.data?.returning_automatic_confirm_ms_interval?.value ?? "100";
  const [codInputs, setCodInputs] = useState<Record<string, string>>({});

  const summary = useQuery({
    queryKey: ["delivery-return-summary", deliveryId],
    enabled: open && deliveryId !== undefined,
    staleTime: 0,
    queryFn: async () => {
      const res = await request(
        "GET",
        `/api/deliveries/${deliveryId}/return-summary`,
      );
      if (!res.ok) throw new Error("Unable to load return summary.");
      return (await res.json()) as ReturnSummary;
    },
  });

  function buildCodPayload(): CodCollectionInput[] | undefined {
    const orders = summary.data?.codOrders ?? [];
    const list: CodCollectionInput[] = [];
    for (const order of orders) {
      const raw = codInputs[order.paymentNumber];
      const amount = Number(raw ?? 0);
      if (Number.isFinite(amount) && amount > 0) {
        list.push({
          paymentNumber: order.paymentNumber,
          amountReceived: amount,
          version: order.paymentVersion,
        });
      }
    }
    return list.length > 0 ? list : undefined;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          if (!value) setCodInputs({});
          onOpenChange(value);
        }
      }}
    >
      {showTrigger && (
        <DialogTrigger render={<Button type="button" variant="outline" disabled={busy} />}>
          {label}
        </DialogTrigger>
      )}
      <DialogContent showCloseButton={!busy} className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm return to warehouse</DialogTitle>
          <DialogDescription>
            Confirm the vehicle and all collected customer returns have
            physically reached {warehouseName ?? "the assigned warehouse"}.
            Customer returns will be marked received for inspection, without
            automatic restocking.
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm">
          All goods from failed delivery stops must have returned in full and be
          suitable for resale. Confirming restores and reserves those goods for
          rescheduling. If goods are missing or damaged, cancel and contact an
          administrator.
        </p>

        {summary.data && summary.data.codOrders.length > 0 ? (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-semibold">
              Pay-on-Delivery (COD) Cash Remittance
            </p>
            <p className="text-xs text-muted-foreground">
              Enter cash remitted by the driver for delivered COD orders to
              record payment receipts atomically on return. Leave 0 to record
              later in Payments.
            </p>
            <div className="space-y-2">
              {summary.data.codOrders.map((order) => (
                <div
                  key={order.paymentNumber}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background p-2 text-xs"
                >
                  <div>
                    <p className="font-medium">
                      {order.orderNumber} · {order.customerName}
                    </p>
                    <p className="text-muted-foreground">
                      Remaining:{" "}
                      {order.remainingAmount !== null
                        ? php.format(Number(order.remainingAmount))
                        : "Unverified"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={busy || order.remainingAmount === null}
                      className="h-8 w-28 text-xs"
                      placeholder="0.00"
                      value={codInputs[order.paymentNumber] ?? ""}
                      onChange={(e) =>
                        setCodInputs((prev) => ({
                          ...prev,
                          [order.paymentNumber]: e.target.value,
                        }))
                      }
                    />
                    {order.remainingAmount !== null ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        disabled={busy}
                        onClick={() =>
                          setCodInputs((prev) => ({
                            ...prev,
                            [order.paymentNumber]: order.remainingAmount ?? "0",
                          }))
                        }
                      >
                        Full
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Returns are automatically confirmed within {radius} metres of the
          assigned warehouse when a fresh, accurate GPS update is available.
          Runs with failed deliveries require manual confirmation.
        </p>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm(buildCodPayload())}
          >
            {busy ? "Confirming…" : "Confirm warehouse return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
