"use client";
import { useState } from "react";
import { CircleDollarSign, PackageCheck, Scale, ShoppingCart, Truck, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Grain, OverviewResponse } from "../../api/contract";
import { useReport } from "../../hooks/use-report";
import { periodLabel } from "../../lib/filters";
import { k, manilaDay, peso } from "../../lib/format";
import { Basis } from "../common/basis";
import { ChartCard } from "../common/chart-card";
import { lineChart, pieChart } from "../common/charts";
import { Kpi } from "../common/kpi";
import { StatusBadge } from "../common/status-badge";
import { TabError, TabSkeleton } from "../common/tab-state";
import type { TabProps } from "./types";

export function OverviewTab({ filters, refreshKey }: TabProps) {
  const { data, loading, error } = useReport<OverviewResponse>("/overview", filters, { refreshKey });
  const [grain, setGrain] = useState<Grain>("week");
  if (error) return <TabError message={error} />;
  if (!data) return <TabSkeleton />;
  const kp = data.kpis;

  return (
    <div className="space-y-4">
      <Basis>Sales by order date, receipts and refunds by their transaction dates, deliveries by scheduled date. Totals become Unverified when an included order lacks saved prices; amount charts exclude those orders. Period: {periodLabel(filters)}.</Basis>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi loading={loading} label="Sales revenue" value={peso(kp.revenue)} delta={kp.revenueDelta} hint="vs previous period" icon={CircleDollarSign} />
        <Kpi loading={loading} label="Orders" value={String(kp.orders)} delta={kp.ordersDelta} hint="non-cancelled" icon={ShoppingCart} />
        <Kpi loading={loading} label="Net cashflow" value={peso(kp.cash)} delta={kp.cashDelta} hint="cash basis" icon={Wallet} />
        <Kpi loading={loading} label="Outstanding balance" value={peso(kp.outstanding)} hint="on filtered orders" icon={Scale} />
        <Kpi loading={loading} label="Stops delivered" value={String(kp.delivered)} delta={kp.deliveredDelta} hint="in period" icon={PackageCheck} />
        <Kpi loading={loading} label="Delivery failure rate" value={`${kp.failureRate.toFixed(1)}%`} hint="failed ÷ attempted stops" icon={Truck} />
      </div>

      <div className="flex items-center gap-2 text-sm">
        Group by
        <Select value={grain} onValueChange={(v) => setGrain(v as Grain)}>
          <SelectTrigger className="w-28" aria-label="Grouping"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="day">Daily</SelectItem><SelectItem value="week">Weekly</SelectItem><SelectItem value="month">Monthly</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard loading={loading} title="Revenue trend" description="Order value by order date">{lineChart(data.trend[grain], k, peso)}</ChartCard>
        <ChartCard loading={loading} title="Orders by status" description="All orders in period, including cancelled">{pieChart(data.ordersByStatus)}</ChartCard>
        <ChartCard loading={loading} title="Payment status" description="Order counts, derived from payments vs order total">{pieChart(data.paymentStatus)}</ChartCard>
        <Card>
          <CardHeader><CardTitle className="text-base">Recent orders</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.recentOrders.map((o) => (
                  <TableRow key={o.id}><TableCell>{manilaDay(o.at)}</TableCell><TableCell>{o.number}</TableCell><TableCell>{o.customer}</TableCell><TableCell>{peso(o.total)}</TableCell><TableCell><StatusBadge s={o.status} /></TableCell></TableRow>
                ))}
                {!data.recentOrders.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No orders in this period.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
