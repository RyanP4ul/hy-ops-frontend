"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { request } from "@/components/http";
import { QueryFeedback } from "@/components/query-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { DeliveryExpense } from "@/schema/deliveries";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export function DeliveryExpensesAction({ deliveryId }: { deliveryId: number }) {
  const [open, setOpen] = useState(false);
  const expenses = useQuery({
    queryKey: ["delivery_expenses", deliveryId],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const response = await request("GET", `/api/deliveries/${deliveryId}/expenses`);
      if (!response.ok) throw new Error("Unable to load delivery expenses.");
      const result = await response.json() as DeliveryExpense[];
      signal.throwIfAborted();
      return result;
    },
  });

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="outline" size="sm" aria-label={`View expenses for delivery ${deliveryId}`} />}>
      <Receipt className="size-4" /> View expenses
    </DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Delivery #{deliveryId} expenses</DialogTitle>
        <DialogDescription>Saved delivery allowance, fuel and toll amounts in Philippine pesos.</DialogDescription>
      </DialogHeader>
      <QueryFeedback query={expenses} label="delivery expenses" />
      {expenses.isPending && !expenses.isError && <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading delivery expenses...</p>}
      {expenses.isSuccess && expenses.data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No expenses have been recorded for this delivery.</p>}
      <div className="max-h-[60vh] space-y-4 overflow-y-auto">
        {expenses.data?.map(expense => <section key={expense.id} className="space-y-4 rounded-lg border p-4" aria-label={`Expense record ${expense.id}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Expense #{expense.id}</p>
            <Badge variant={expense.status === "rejected" ? "destructive" : "outline"} className="capitalize">{expense.status}</Badge>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt>Delivery allowance</dt><dd className="tabular-nums">{currency.format(Number(expense.delivery_allowance))}</dd></div>
            <div className="flex justify-between gap-4"><dt>Fuel</dt><dd className="tabular-nums">{currency.format(Number(expense.fuel))}</dd></div>
            <div className="flex justify-between gap-4"><dt>Toll</dt><dd className="tabular-nums">{currency.format(Number(expense.toll))}</dd></div>
            <div className="flex justify-between gap-4 border-t pt-3 font-semibold"><dt>Total</dt><dd className="tabular-nums">{currency.format(Number(expense.delivery_allowance) + Number(expense.fuel) + Number(expense.toll))}</dd></div>
          </dl>
        </section>)}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={expenses.isFetching} onClick={() => void expenses.refetch()}>Refresh expenses</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
