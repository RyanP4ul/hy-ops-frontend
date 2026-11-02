"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Boxes, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Package, RefreshCw, Truck, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DeliveryCalendarDetails } from "@/components/delivery-calendar-details";
import { deliveryStatusLabel, type DeliveryCalendarEntry } from "@/schema/delivery-calendar";
import { formatCurrency, manilaCalendarNow, parseLocalDateTime } from "@/utils/date-util";
import { QueryFeedback } from "@/components/query-feedback";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "../provider";
import StatsCard from "./stats-card";
import DashboardFleetMap from "./dashboard-fleet-map";
import { OperationalExceptions } from "./operational-exceptions";
import RevenueOverview from "./revenue-overview";

function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0 space-y-1"><h2 className="text-base font-semibold tracking-tight">{title}</h2>{description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}</div>
    {action}
  </div>;
}

function ViewLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-2 text-sm font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">{children}<ArrowRight aria-hidden="true" className="size-4" /></Link>;
}

function StatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase();
  const styles: Record<string, string> = {
    SCHEDULED: "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    IN_TRANSIT: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    RETURNING: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    COMPLETED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    DELIVERED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    CANCELLED: "border-destructive/20 bg-destructive/5 text-destructive",
  };
  return <Badge variant="outline" className={`whitespace-nowrap ${styles[key] ?? ""}`}>{key.toLowerCase().replace(/_/g, " ").replace(/^./, char => char.toUpperCase())}</Badge>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center rounded-lg bg-muted/30 p-6 text-center"><Package aria-hidden="true" className="mb-3 size-5 text-muted-foreground" /><p className="text-sm font-medium">{title}</p><p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p></div>;
}

function makeDateKey(year: number, monthIndex: number, day: number) {
  return [
    year,
    String(monthIndex + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function CalendarWidget({ events }: { events: DeliveryCalendarEntry[] }) {
  const today = manilaCalendarNow();
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    makeDateKey(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const day = index - firstDay + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  const deliveryEventCounts = events.reduce<Record<string, number>>(
    (counts, event) => {
      counts[event.date] = (counts[event.date] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const selectedDeliveries = events.filter(event => event.date === selectedDate);
  const selectedCount = selectedDeliveries.length;
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null);

  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  return (
    <Card className="h-full min-w-0 shadow-none" role="region" aria-label="Dashboard delivery calendar">
      <DeliveryCalendarDetails delivery={events.find(delivery => delivery.id === selectedDeliveryId)} onClose={() => setSelectedDeliveryId(null)} />
      <CardHeader className="pb-3">
        <SectionHeading
          title="Delivery calendar"
          description="Choose a date to see departures."
          action={<CalendarDays className="size-5 text-muted-foreground" />}
        />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            {month.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>

          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => {
              setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedDate(makeDateKey(today.getFullYear(), today.getMonth(), today.getDate()));
            }}>Today</Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Previous month"
              onClick={() =>
                setMonth(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Next month"
              onClick={() =>
                setMonth(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div
              key={day}
              className="pb-2 text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}

          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} />;
            }

            const dateKey = makeDateKey(year, monthIndex, day);
            const eventCount = deliveryEventCounts[dateKey] ?? 0;
            const isSelected = selectedDate === dateKey;
            const isToday =
              dateKey ===
              makeDateKey(
                today.getFullYear(),
                today.getMonth(),
                today.getDate(),
              );

            return (
              <button
                key={dateKey}
                type="button"
                aria-label={`${dateKey}${eventCount ? `, ${eventCount} deliveries` : ""}`}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                onClick={() => setSelectedDate(dateKey)}
                className={[
                  "relative mx-auto flex h-10 w-full max-w-10 flex-col items-center justify-center rounded-lg text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                  isToday && !isSelected
                    ? "font-bold ring-1 ring-primary/40"
                    : "",
                ].join(" ")}
              >
                {day}

                {eventCount > 0 && (
                  <span
                    className={[
                      "absolute bottom-1 size-1 rounded-full",
                      isSelected ? "bg-primary-foreground" : "bg-blue-500",
                    ].join(" ")}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{selectedLabel}</p>
              <p className="text-xs text-muted-foreground">Manila time</p>
            </div>

            <Badge variant="secondary">
              {selectedCount} {selectedCount === 1 ? "delivery" : "deliveries"}
            </Badge>
          </div>

          {selectedDeliveries.length ? <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {selectedDeliveries.map(delivery => <li key={delivery.id}><button type="button" aria-label={`View delivery #${delivery.id}`} className="w-full rounded-md border bg-background p-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setSelectedDeliveryId(delivery.id)}>
              <span className="block font-medium">Delivery #{delivery.id} / {delivery.vehicle}</span>
              <span className="block text-xs text-muted-foreground">{parseLocalDateTime(delivery.date, delivery.start_time).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })} / {deliveryStatusLabel[delivery.status]}</span>
              <span className="block truncate text-xs text-muted-foreground">{delivery.driver}</span>
            </button></li>)}
          </ul> : <p className="mt-3 text-xs text-muted-foreground">No deliveries on this date.</p>}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-blue-500" />
            Dates with deliveries
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return <div role="status" aria-label="Loading dashboard statistics" className="space-y-6">
    <span className="sr-only">Loading dashboard statistics...</span>
    <div aria-hidden="true" className="space-y-6 motion-reduce:[&_*]:animate-none">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0,1,2,3].map(item => <Skeleton key={item} className="h-44 w-full rounded-xl" />)}</div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><Skeleton className="h-[560px] w-full" /><Skeleton className="h-[560px] w-full rounded-xl" /></div>
      <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-72 w-full rounded-xl" /><Skeleton className="h-72 w-full rounded-xl" /></div>
    </div>
  </div>;
}

export default function DashboardPage() {
  const { dashboardQuery } = useDashboard();
  const cache = useQueryClient();
  const data = dashboardQuery.data;
  const dailySalesData = data?.daily_sales ?? [];
  const topProducts = data?.top_selling_products ?? [];
  const topCustomers = data?.top_customers ?? [];
  const activeDeliveries = data?.active_deliveries ?? [];
  const upcomingDeliveries = data?.upcoming_deliveries ?? [];
  const dailySalesTotal = dailySalesData.reduce((total, item) => total + Math.round(Number(item.sales) * 100), 0) / 100;
  const dateLabel = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date());

  return <main className="min-w-0 bg-muted/15 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
    <div className="mx-auto max-w-[1600px] space-y-6 lg:space-y-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div><p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Operations overview</p><h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Keep orders moving, follow your fleet, and see what needs attention.</p><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays aria-hidden="true" className="size-4" />{dateLabel} <span className="text-muted-foreground/70">/ Manila</span></p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={dashboardQuery.isFetching} onClick={() => void cache.invalidateQueries({ queryKey: ["dashboard_query"] })}><RefreshCw aria-hidden="true" className={`size-4 ${dashboardQuery.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} />{dashboardQuery.isFetching ? "Refreshing..." : "Refresh overview"}</Button>
          <Button nativeButton={false} render={<Link href="/panel/orders" />}><Package aria-hidden="true" className="size-4" />Manage orders</Button>
        </div>
      </header>
      <QueryFeedback query={dashboardQuery} label="dashboard statistics" />
      {dashboardQuery.isPending ? <DashboardSkeleton /> : !data ? <><EmptyState title="Dashboard overview is unavailable" description="Use Retry above to load your statistics. You can still open orders and delivery operations from the navigation." /><OperationalExceptions /></> : <>
        <section aria-label="Business summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatsCard /></section>
        <OperationalExceptions />

        <section aria-labelledby="dashboard-fleet-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="dashboard-fleet-heading" className="text-xl font-semibold tracking-tight">Fleet & delivery schedule</h2><p className="mt-1 text-sm text-muted-foreground">Vehicle locations, routes to destinations, and scheduled departures.</p></div><ViewLink href="/panel/fleet-map">Open fleet map</ViewLink></div>
          <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-3"><DashboardFleetMap /><div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Truck aria-hidden="true" className="size-4" />Vehicle GPS</span><span className="inline-flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4" />Next destination</span><span>Open the fleet map to manage vehicles and return pickups.</span></div></div>
            <CalendarWidget events={data.delivery_calendar ?? []} />
          </div>
        </section>

        <section aria-label="Delivery operations" className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card className="min-w-0 shadow-none"><CardHeader><SectionHeading title="Active deliveries" description="Scheduled, in transit and returning runs." action={<ViewLink href="/panel/deliveries">View deliveries</ViewLink>} /></CardHeader><CardContent>
            {!activeDeliveries.length ? <EmptyState title="No active deliveries" description="Scheduled and ongoing delivery runs will appear here." /> : <ul className="divide-y">{activeDeliveries.map(delivery => <li key={delivery.run} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-semibold">{delivery.run}</p><p className="mt-1 break-words text-sm">{delivery.customer}</p></div><StatusBadge status={delivery.status} /></div><div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><p className="flex min-w-0 items-start gap-2"><Users aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="break-words">{delivery.driver}</span></p><p className="flex min-w-0 items-start gap-2"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span className="break-words">{delivery.destination}</span></p></div><p className="mt-3 text-xs font-medium text-muted-foreground">{delivery.progress}</p></li>)}</ul>}
          </CardContent></Card>
          <Card className="min-w-0 shadow-none"><CardHeader><SectionHeading title="Upcoming deliveries" description="Next departures, in Manila time." action={<CalendarClock aria-hidden="true" className="size-5 text-muted-foreground" />} /></CardHeader><CardContent className="space-y-5">
            {upcomingDeliveries.length ? <ul className="divide-y">{upcomingDeliveries.map(delivery => {
              const departure = parseLocalDateTime(delivery.date, delivery.time);
              return <li key={delivery.run} className="flex gap-3 py-4 first:pt-0 last:pb-0"><div aria-hidden="true" className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-muted/60"><span className="text-[11px] font-medium uppercase text-muted-foreground">{departure.toLocaleDateString("en-PH", { month: "short" })}</span><span className="text-xl font-semibold tabular-nums">{departure.getDate()}</span></div><div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">{delivery.run}</p><p className="mt-1 break-words text-sm font-semibold">{delivery.customer}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" /><time dateTime={`${delivery.date}T${delivery.time}+08:00`}>{departure.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} at {departure.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</time></p><p className="mt-2 break-words text-xs text-muted-foreground">{delivery.destination}</p><p className="mt-1 break-words text-xs text-muted-foreground">Driver: {delivery.driver}</p></div></li>;
            })}</ul> : <EmptyState title="No upcoming departures" description="New scheduled delivery runs will appear here." />}
            <ViewLink href="/panel/delivery-schedules">View delivery schedule</ViewLink>
          </CardContent></Card>
        </section>

        <section aria-labelledby="dashboard-performance-heading" className="space-y-4">
          <div><h2 id="dashboard-performance-heading" className="text-xl font-semibold tracking-tight">Business performance</h2><p className="mt-1 text-sm text-muted-foreground">Cash movements and order activity. All amounts are in Philippine pesos.</p></div>
          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <Card className="min-w-0 shadow-none"><CardHeader><SectionHeading title="Monthly net cashflow" description="Last six Manila months / All warehouses" /></CardHeader><CardContent><RevenueOverview /></CardContent></Card>
            <Card className="min-w-0 shadow-none"><CardHeader><SectionHeading title="Daily net cashflow" description="Last seven Manila days / All warehouses" /></CardHeader><CardContent><p className="text-3xl font-semibold tracking-tight tabular-nums">{formatCurrency(dailySalesTotal)}</p><p className="mt-1 text-sm text-muted-foreground">Receipts minus refunds over the last seven days.</p><div className="mt-5 h-[260px] min-w-0">
              {!dailySalesData.length ? <EmptyState title="No daily cashflow data" description="Recorded receipts and refunds will appear here." /> : dailySalesData.every(item => Number(item.sales) === 0) ? <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">No net cash movement over the last seven days.</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={dailySalesData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} /><YAxis width={48} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={value => new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))} /><Tooltip formatter={value => [formatCurrency(Number(value)), "Net cashflow"]} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }} /><Bar dataKey="sales" fill="var(--primary)" radius={[4,4,0,0]} maxBarSize={32} isAnimationActive={false} /></BarChart></ResponsiveContainer>}
            </div></CardContent></Card>
            <Card className="min-w-0 shadow-none"><CardHeader><SectionHeading title="Top-selling products" description="All-time quantities from non-cancelled orders." action={<Boxes aria-hidden="true" className="size-5 text-muted-foreground" />} /></CardHeader><CardContent>
              {!topProducts.length ? <EmptyState title="No products to rank yet" description="Products will appear after non-cancelled orders are recorded." /> : <ol className="divide-y">{topProducts.map((product, index) => <li key={product.sku} className="py-4 first:pt-0 last:pb-0"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">{index + 1}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{product.name}</p><p className="mt-1 break-all text-xs text-muted-foreground">{product.sku}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold tabular-nums">{product.sold.toLocaleString()} units</p><p className="mt-1 text-xs text-muted-foreground">{product.revenue === null ? "Amount unverified" : formatCurrency(product.revenue)}</p></div></div><div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(0, Math.min(100, product.percent))}%` }} /></div></li>)}</ol>}
              <p className="mt-5 border-t pt-3 text-xs leading-relaxed text-muted-foreground">Amounts use the prices saved at checkout.</p>
            </CardContent></Card>
            <Card className="min-w-0 shadow-none"><CardHeader><SectionHeading title="Top customers by orders" description="All-time non-cancelled orders." action={<Users aria-hidden="true" className="size-5 text-muted-foreground" />} /></CardHeader><CardContent>
              {!topCustomers.length ? <EmptyState title="No customers to rank yet" description="Customers with non-cancelled orders will appear here." /> : <ol className="divide-y">{topCustomers.map((customer, index) => <li key={`${customer.name}-${index}`} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{index + 1}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{customer.name}</p><p className="mt-1 break-words text-xs text-muted-foreground">{customer.location}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold tabular-nums">{customer.orders.toLocaleString()} orders</p><p className="mt-1 text-xs text-muted-foreground">{customer.amount === null ? "Amount unverified" : formatCurrency(customer.amount)}</p></div></li>)}</ol>}
              <p className="mt-5 border-t pt-3 text-xs leading-relaxed text-muted-foreground">Order amounts use the prices saved at checkout.</p>
            </CardContent></Card>
          </div>
        </section>
      </>}
    </div>
  </main>;
}
