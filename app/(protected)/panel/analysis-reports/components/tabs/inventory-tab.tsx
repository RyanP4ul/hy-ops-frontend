"use client";
import { useState } from "react";
import { AlertTriangle, CircleDollarSign, PackageCheck, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InventoryResponse } from "../../api/contract";
import { SLOW_UNITS } from "../../constants";
import { useReport } from "../../hooks/use-report";
import { periodLabel } from "../../lib/filters";
import { manilaDay, peso } from "../../lib/format";
import { Basis } from "../common/basis";
import { ChartCard } from "../common/chart-card";
import { barsChart, stackedStockChart } from "../common/charts";
import { Kpi } from "../common/kpi";
import { TabError, TabSkeleton } from "../common/tab-state";
import type { TabProps } from "./types";

export function InventoryTab({ filters, refreshKey, threshold, onThresholdChange }: TabProps & { threshold: number; onThresholdChange: (n: number) => void }) {
  const { data, loading, error } = useReport<InventoryResponse>("/inventory", filters, { refreshKey });
  const [lowOnly, setLowOnly] = useState(false);
  if (error) return <TabError message={error} />;
  if (!data) return <TabSkeleton />;

  // The threshold is a UI control, so low / out / slow are derived here from the rows the API returned.
  const stock = data.rows;
  const low = stock.filter((r) => r.available > 0 && r.available <= threshold);
  const out = stock.filter((r) => r.available <= 0);
  const stockRows = lowOnly ? stock.filter((r) => r.available <= threshold) : stock;
  const slow = stock.filter((r) => r.available > 0 && r.unitsSold <= SLOW_UNITS);
  const level = (a: number) => (a <= 0 ? "OUT" : a <= threshold ? "LOW" : "OK");

  const bySku = new Map<string, { name: string; Available: number; Reserved: number }>();
  stock.forEach((r) => {
    const e = bySku.get(r.sku) ?? { name: r.sku, Available: 0, Reserved: 0 };
    e.Available += r.available; e.Reserved += r.reserved;
    bySku.set(r.sku, e);
  });

  return (
    <div className="space-y-4">
      <Basis>stock is a current snapshot; units sold use the selected period. Quantities are per warehouse (filter by warehouse above).</Basis>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi loading={loading} label="Stock rows" value={String(stock.length)} hint="warehouse × variant" icon={PackageCheck} />
        <Kpi loading={loading} label="Low stock" value={String(low.length)} hint={`available ≤ ${threshold}`} icon={AlertTriangle} />
        <Kpi loading={loading} label="Out of stock" value={String(out.length)} hint="available = 0" icon={AlertTriangle} />
        <Kpi loading={loading} label="Reserved units" value={String(stock.reduce((s, r) => s + r.reserved, 0))} hint="open orders" icon={Scale} />
        <Kpi loading={loading} label="Stock value" value={peso(stock.reduce((s, r) => s + r.quantity * r.price, 0))} hint="at current price" icon={CircleDollarSign} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">Low-stock threshold<Input type="number" min={0} className="w-20" value={threshold} onChange={(e) => onThresholdChange(Math.max(0, Number(e.target.value)))} /></label>
        <label className="flex items-center gap-2"><Switch checked={lowOnly} onCheckedChange={setLowOnly} />Low / out of stock only</label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard loading={loading} title="Top sellers by units" description={`Units sold, ${periodLabel(filters)}`}>{barsChart(data.topSellers)}</ChartCard>
        <ChartCard loading={loading} title="Stock by variant" description="Available vs reserved (selected warehouses)">{stackedStockChart([...bySku.values()])}</ChartCard>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Stock levels</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Variant</TableHead><TableHead>SKU</TableHead><TableHead>Warehouse</TableHead><TableHead>On hand</TableHead><TableHead>Reserved</TableHead><TableHead>Available</TableHead><TableHead>Level</TableHead></TableRow></TableHeader>
            <TableBody>
              {stockRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.product}</TableCell><TableCell>{r.variant}</TableCell><TableCell>{r.sku}</TableCell><TableCell>{r.warehouse}</TableCell>
                  <TableCell>{r.quantity}</TableCell><TableCell>{r.reserved}</TableCell><TableCell>{r.available} {r.unit}</TableCell>
                  <TableCell><Badge variant={level(r.available) === "OK" ? "secondary" : "destructive"}>{level(r.available)}</Badge></TableCell>
                </TableRow>
              ))}
              {!stockRows.length && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No stock rows for these filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Slow-moving products</CardTitle>
          <CardDescription>In stock, {SLOW_UNITS} or fewer units sold in {periodLabel(filters)}. Last sold comes from order items (no stock-movement table).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Warehouse</TableHead><TableHead>Available</TableHead><TableHead>Units sold</TableHead><TableHead>Last sold</TableHead></TableRow></TableHeader>
            <TableBody>
              {slow.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.product} {r.variant}</TableCell><TableCell>{r.sku}</TableCell><TableCell>{r.warehouse}</TableCell>
                  <TableCell>{r.available}</TableCell><TableCell>{r.unitsSold}</TableCell><TableCell>{r.lastSoldAt ? manilaDay(r.lastSoldAt) : "never"}</TableCell>
                </TableRow>
              ))}
              {!slow.length && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No slow-moving products in this period.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
