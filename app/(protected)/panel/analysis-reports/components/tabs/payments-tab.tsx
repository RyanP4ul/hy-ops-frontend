"use client";
import { AlertTriangle, CircleDollarSign, Scale, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PaymentsResponse } from "../../api/contract";
import { useReport } from "../../hooks/use-report";
import { k, label, manilaDay, peso } from "../../lib/format";
import { Basis } from "../common/basis";
import { ChartCard } from "../common/chart-card";
import { barsChart, pieChart } from "../common/charts";
import { Kpi } from "../common/kpi";
import { StatusBadge } from "../common/status-badge";
import { TabError, TabSkeleton } from "../common/tab-state";
import type { TabProps } from "./types";

export function PaymentsTab({ filters, refreshKey }: TabProps) {
  const { data, loading, error } = useReport<PaymentsResponse>("/payments", filters, { refreshKey });
  if (error) return <TabError message={error} />;
  if (!data) return <TabSkeleton />;
  const kp = data.kpis;

  return (
    <div className="space-y-4">
      <Basis>Cashflow = receipts on collection date minus refunds on refund date, including cancelled orders; legacy aggregates use their recorded receipt date. Balances are current balances of non-cancelled orders created in the selected period, not balances as of the period end. Balance totals become Unverified if included orders lack saved prices; aging excludes those orders. Due dates follow configured payment terms.</Basis>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi loading={loading} label="Net cashflow" value={peso(kp.cash)} delta={kp.cashDelta} hint="vs previous" icon={Wallet} />
        <Kpi loading={loading} label="Outstanding balance" value={peso(kp.outstanding)} icon={Scale} />
        <Kpi loading={loading} label="Overdue balance" value={peso(kp.overdue)} hint="past due with balance" icon={AlertTriangle} />
        <Kpi loading={loading} label="Partially paid orders" value={String(kp.partiallyPaid)} icon={CircleDollarSign} />
      </div>
      <p className="text-sm text-muted-foreground">Gross receipts: {peso(kp.received)} | Refunds: {peso(kp.refunded)} | Dates use Asia/Manila.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard loading={loading} title="Net cashflow by method">{barsChart(data.byMethod, k, peso)}</ChartCard>
        <ChartCard loading={loading} title="Payment arrangement" description="Order counts">{pieChart(data.byArrangement)}</ChartCard>
        <ChartCard loading={loading} title="Receivables aging" description="Balance by days past due">{barsChart(data.aging, k, peso)}</ChartCard>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Open balances</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Terms</TableHead><TableHead>Due</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.openBalances.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{o.number}</TableCell><TableCell>{o.customer}</TableCell><TableCell>{label(o.arrangement)}</TableCell><TableCell>{o.dueAt ? manilaDay(o.dueAt) : "—"}</TableCell>
                  <TableCell>{peso(o.total)}</TableCell><TableCell>{peso(o.paid)}</TableCell><TableCell>{peso(o.balance)}</TableCell><TableCell><StatusBadge s={o.payStatus} /></TableCell>
                </TableRow>
              ))}
              {!data.openBalances.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No open balances for these filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
          {data.openBalanceCount > data.openBalances.length && (
            <p className="mt-3 text-sm text-muted-foreground">Showing the {data.openBalances.length} largest of {data.openBalanceCount} open balances (overdue first).</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
