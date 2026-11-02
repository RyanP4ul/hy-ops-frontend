"use client";
import { RefreshCw, Scale, ShoppingCart, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CustomersResponse } from "../../api/contract";
import { useReport } from "../../hooks/use-report";
import { manilaDay, peso } from "../../lib/format";
import { Basis } from "../common/basis";
import { Kpi } from "../common/kpi";
import { TabError, TabSkeleton } from "../common/tab-state";
import type { TabProps } from "./types";

export function CustomersTab({ filters, refreshKey, onSelect }: TabProps & { onSelect: (c: { id: number; name: string }) => void }) {
  const { data, loading, error } = useReport<CustomersResponse>("/customers", filters, { refreshKey });
  if (error) return <TabError message={error} />;
  if (!data) return <TabSkeleton />;
  const kp = data.kpis;

  return (
    <div className="space-y-4">
      <Basis>order created date. Sales and payments are separate figures; customer sales are unverified when any legacy order lacks a saved price.</Basis>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi loading={loading} label="Customers with orders" value={String(kp.customers)} hint="in period" icon={ShoppingCart} />
        <Kpi loading={loading} label="Repeat customers" value={String(kp.repeat)} hint="2+ orders" icon={RefreshCw} />
        <Kpi loading={loading} label="Avg order value" value={peso(kp.aov)} icon={Scale} />
        <Kpi loading={loading} label="Outstanding" value={peso(kp.outstanding)} hint="all customers shown" icon={Wallet} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Customer performance</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Orders</TableHead><TableHead>Sales</TableHead><TableHead>Payments</TableHead><TableHead>Outstanding</TableHead><TableHead>Last order</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><button className="font-medium hover:underline" onClick={() => onSelect({ id: c.id, name: c.name })}>{c.name}</button></TableCell>
                  <TableCell>{c.orders}</TableCell><TableCell>{peso(c.sales)}</TableCell><TableCell>{peso(c.paid)}</TableCell><TableCell>{peso(c.balance)}</TableCell><TableCell>{manilaDay(c.lastOrderAt)}</TableCell>
                </TableRow>
              ))}
              {!data.rows.length && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No customers with orders for these filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
