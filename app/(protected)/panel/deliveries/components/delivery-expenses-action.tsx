"use client";

import type { TableAction } from "@/components/table-actions";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { request } from "@/components/http";
import { QueryFeedback } from "@/components/query-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resourceQueryRoots } from "@/lib/realtime";
import type { DeliveryExpense } from "@/schema/deliveries";

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

function ExpenseCard({
  deliveryId,
  expense,
  onSettled,
}: {
  deliveryId: number;
  expense: DeliveryExpense;
  onSettled: () => Promise<void>;
}) {
  const [allowance, setAllowance] = useState(
    expense.actual_delivery_allowance ?? expense.delivery_allowance,
  );
  const [fuel, setFuel] = useState(expense.actual_fuel ?? expense.fuel);
  const [toll, setToll] = useState(expense.actual_toll ?? expense.toll);
  const [notes, setNotes] = useState(expense.settlement_notes ?? "");
  const [busy, setBusy] = useState(false);

  const estimatedTotal =
    Number(expense.delivery_allowance) +
    Number(expense.fuel) +
    Number(expense.toll);
  const actualTotal =
    Number(allowance || 0) + Number(fuel || 0) + Number(toll || 0);

  async function settle(status: "approved" | "rejected") {
    if (busy) return;
    setBusy(true);
    try {
      const response = await request(
        "PATCH",
        `/api/deliveries/${deliveryId}/expenses/${expense.id}`,
        {
          status,
          actual_delivery_allowance: Number(allowance),
          actual_fuel: Number(fuel),
          actual_toll: Number(toll),
          settlement_notes: notes.trim() || undefined,
          version: expense.version ?? 1,
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to settle delivery expense.");
      }
      toast.success(
        status === "approved"
          ? "Delivery expense approved."
          : "Delivery expense rejected.",
      );
      await onSettled();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to settle delivery expense.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="space-y-4 rounded-lg border p-4"
      aria-label={`Expense record ${expense.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Expense #{expense.id}</p>
        <Badge
          variant={
            expense.status === "rejected"
              ? "destructive"
              : expense.status === "approved"
                ? "default"
                : "outline"
          }
          className="capitalize"
        >
          {expense.status}
        </Badge>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Estimated allowance</dt>
          <dd className="tabular-nums">
            {currency.format(Number(expense.delivery_allowance))}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Estimated fuel</dt>
          <dd className="tabular-nums">
            {currency.format(Number(expense.fuel))}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Estimated toll</dt>
          <dd className="tabular-nums">
            {currency.format(Number(expense.toll))}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t pt-2 font-medium">
          <dt>Estimated total</dt>
          <dd className="tabular-nums">{currency.format(estimatedTotal)}</dd>
        </div>
      </dl>

      {expense.status === "pending" ? (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Settle actual trip costs (PHP)
          </p>
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 text-xs">
              <span>Allowance</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={busy}
                value={allowance}
                onChange={(e) => setAllowance(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span>Fuel</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={busy}
                value={fuel}
                onChange={(e) => setFuel(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span>Toll</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={busy}
                value={toll}
                onChange={(e) => setToll(e.target.value)}
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs">
            <span>Settlement notes (optional)</span>
            <Input
              type="text"
              maxLength={500}
              disabled={busy}
              placeholder="Receipt reference or variance note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Settled total</span>
            <span className="tabular-nums">{currency.format(actualTotal)}</span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1"
              disabled={busy}
              onClick={() => void settle("approved")}
            >
              {busy ? "Saving…" : "Approve expense"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => void settle("rejected")}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : (
        <dl className="space-y-2 border-t pt-3 text-sm">
          <div className="flex justify-between gap-4 font-semibold">
            <dt>Settled total</dt>
            <dd className="tabular-nums">{currency.format(actualTotal)}</dd>
          </div>
          {expense.settlement_notes ? (
            <p className="text-xs text-muted-foreground">
              Notes: {expense.settlement_notes}
            </p>
          ) : null}
        </dl>
      )}
    </section>
  );
}

export function useDeliveryExpenses({ deliveryId }: { deliveryId: number }) {
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  const expenses = useQuery({
    queryKey: ["delivery_expenses", deliveryId],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const response = await request(
        "GET",
        `/api/deliveries/${deliveryId}/expenses`,
      );
      if (!response.ok) throw new Error("Unable to load delivery expenses.");
      const result = (await response.json()) as DeliveryExpense[];
      signal.throwIfAborted();
      return result;
    },
  });

  async function onSettled() {
    await expenses.refetch();
    await Promise.all(
      resourceQueryRoots.deliveries.map((root) =>
        cache.invalidateQueries({ queryKey: [root] }),
      ),
    );
  }

  const action: TableAction = {
    label: "View expenses",
    icon: Receipt,
    ariaLabel: `View expenses for delivery ${deliveryId}`,
    onClick: () => setOpen(true),
  };
  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delivery #{deliveryId} expenses</DialogTitle>
          <DialogDescription>
            Review estimated costs and settle actual delivery allowance, fuel,
            and toll in Philippine pesos.
          </DialogDescription>
        </DialogHeader>
        <QueryFeedback query={expenses} label="delivery expenses" />
        {expenses.isPending && !expenses.isError && (
          <p
            role="status"
            className="py-8 text-center text-sm text-muted-foreground"
          >
            Loading delivery expenses...
          </p>
        )}
        {expenses.isSuccess && expenses.data.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No expenses have been recorded for this delivery.
          </p>
        )}
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {expenses.data?.map((expense) => (
            <ExpenseCard
              key={`${expense.id}-${expense.version ?? 1}-${expense.status}`}
              deliveryId={deliveryId}
              expense={expense}
              onSettled={onSettled}
            />
          ))}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={expenses.isFetching}
            onClick={() => void expenses.refetch()}
          >
            Refresh expenses
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { action, dialog };
}
