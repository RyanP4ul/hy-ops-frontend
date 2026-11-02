"use client";
import { AlertTriangle, PackageCheck, RefreshCw, Scale, Truck, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DeliveriesResponse } from "../../api/contract";
import { useReport } from "../../hooks/use-report";
import { peso } from "../../lib/format";
import { Basis } from "../common/basis";
import { ChartCard } from "../common/chart-card";
import { barsChart, pieChart } from "../common/charts";
import { Kpi } from "../common/kpi";
import { StatusBadge } from "../common/status-badge";
import { TabError, TabSkeleton } from "../common/tab-state";
import type { TabProps } from "./types";

export function DeliveriesTab({ filters, refreshKey }: TabProps) {
  const { data, loading, error } = useReport<DeliveriesResponse>("/deliveries", filters, { refreshKey });
  if (error) return <TabError message={error} />;
  if (!data) return <TabSkeleton />;
  const kp = data.kpis;

  return (
    <div className="space-y-4">
      <Basis>delivery scheduled date. A delivery is counted once however many stops it has; failure rate = failed ÷ (delivered + failed) stops; cancelled deliveries excluded.</Basis>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi loading={loading} label="Deliveries" value={String(kp.deliveries)} delta={kp.deliveriesDelta} hint="vs previous" icon={Truck} />
        <Kpi loading={loading} label="Stops delivered" value={String(kp.delivered)} icon={PackageCheck} />
        <Kpi loading={loading} label="Failed stops" value={String(kp.failed)} icon={AlertTriangle} />
        <Kpi loading={loading} label="Failure rate" value={`${kp.failureRate.toFixed(1)}%`} icon={Scale} />
        <Kpi loading={loading} label="Avg completion" value={`${Math.round(kp.avgMinutes)} min`} hint="departure to last stop" icon={RefreshCw} />
        <Kpi loading={loading} label="Approved cost" value={peso(kp.approvedCost)} hint="allowance + fuel + toll" icon={Wallet} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard loading={loading} title="Deliveries by type">{pieChart(data.byType)}</ChartCard>
        <ChartCard loading={loading} title="Deliveries by vehicle">{barsChart(data.byVehicle)}</ChartCard>
        <ChartCard loading={loading} title="Deliveries by status">{pieChart(data.byStatus)}</ChartCard>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery issues</CardTitle>
          <CardDescription>Failed, delayed, rescheduled and cancelled events.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Delivery</TableHead><TableHead>Vehicle</TableHead><TableHead>Driver</TableHead><TableHead>Event</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.issues.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.date}</TableCell><TableCell>#{e.deliveryId}</TableCell><TableCell>{e.vehicle}</TableCell><TableCell>{e.driver}</TableCell>
                  <TableCell><StatusBadge s={e.type} /></TableCell><TableCell>{e.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!data.issues.length && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No delivery issues in this period.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
