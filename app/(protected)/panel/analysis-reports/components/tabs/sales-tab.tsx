"use client";
import { CircleDollarSign, PackageCheck, Scale, ShoppingCart } from "lucide-react";
import type { SalesResponse } from "../../api/contract";
import { useReport } from "../../hooks/use-report";
import { k, peso } from "../../lib/format";
import { Basis } from "../common/basis";
import { ChartCard } from "../common/chart-card";
import { barsChart } from "../common/charts";
import { Kpi } from "../common/kpi";
import { OrdersTable } from "../common/orders-table";
import { TabError, TabSkeleton } from "../common/tab-state";
import type { TabProps } from "./types";

export function SalesTab({ filters, refreshKey }: TabProps) {
  const { data, loading, error } = useReport<SalesResponse>("/sales", filters, { refreshKey });
  if (error) return <TabError message={error} />;
  if (!data) return <TabSkeleton />;
  const kp = data.kpis;

  return (
    <div className="space-y-4">
      <Basis>Order created date; cancelled orders are excluded from sales. Product filters select whole orders containing those products, so totals and breakdowns include every item in each matching order. Saved checkout prices are authoritative. Orders with any missing saved price are Unverified and excluded from every amount chart.</Basis>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi loading={loading} label="Total sales" value={peso(kp.revenue)} delta={kp.revenueDelta} hint="vs previous" icon={CircleDollarSign} />
        <Kpi loading={loading} label="Orders" value={String(kp.orders)} hint={`${kp.cancelled} cancelled excluded`} icon={ShoppingCart} />
        <Kpi loading={loading} label="Average order value" value={peso(kp.aov)} icon={Scale} />
        <Kpi loading={loading} label="Units sold" value={String(kp.units)} hint="all order items" icon={PackageCheck} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard loading={loading} title="Sales by product" description="Item totals">{barsChart(data.byProduct, k, peso)}</ChartCard>
        <ChartCard loading={loading} title="Sales by warehouse">{barsChart(data.byWarehouse, k, peso)}</ChartCard>
        <ChartCard loading={loading} title="Sales by customer">{barsChart(data.byCustomer, k, peso)}</ChartCard>
      </div>
      <OrdersTable rows={data.orders} />
    </div>
  );
}
