"use client";

import { useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  MapPin,
  Package,
  Search,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboard } from "../provider";
import StatsCard from "./stats-card";
import { Map } from "@/components/ui/map";
import { formatCurrency } from "@/utils/date-util";
import RevenueOverview from "./revenue-overview";

// import DeliveryMapInner from "./deliver-map";

const recentActivity = [
  {
    title: "Order marked as ready for delivery",
    detail: "ORD-0251 · ABC Trading",
    time: "5 minutes ago",
    icon: Package,
    color: "text-blue-600 bg-blue-500/10",
  },
  {
    title: "Delivery successfully completed",
    detail: "RUN-0008 · 3 orders delivered",
    time: "24 minutes ago",
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-500/10",
  },
  {
    title: "New order received",
    detail: "ORD-0252 · Northern Supplies",
    time: "1 hour ago",
    icon: ShoppingCart,
    color: "text-violet-600 bg-violet-500/10",
  },
  {
    title: "Delivery rescheduled",
    detail: "RUN-0009 · Customer request",
    time: "2 hours ago",
    icon: CalendarClock,
    color: "text-amber-600 bg-amber-500/10",
  },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SCHEDULED:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    IN_TRANSIT:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    COMPLETED:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    CANCELLED:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <Badge variant="outline" className={styles[status] ?? ""}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>

        {description && <CardDescription>{description}</CardDescription>}
      </div>

      {action}
    </div>
  );
}

// --------------------------------------------------
// Calendar widget
// --------------------------------------------------

function makeDateKey(year: number, monthIndex: number, day: number) {
  return [
    year,
    String(monthIndex + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function CalendarWidget({
  events,
}: {
  events: Array<{ date: string }>;
}) {
  const today = new Date();
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
  const selectedCount = deliveryEventCounts[selectedDate] ?? 0;

  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <SectionHeading
          title="Delivery Calendar"
          description="Scheduled delivery activity"
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

          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
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
              className="size-8"
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
                onClick={() => setSelectedDate(dateKey)}
                className={[
                  "relative mx-auto flex size-9 flex-col items-center justify-center rounded-lg text-sm transition-colors",
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
              <p className="text-xs text-muted-foreground">Selected date</p>
            </div>

            <Badge variant="secondary">
              {selectedCount} {selectedCount === 1 ? "delivery" : "deliveries"}
            </Badge>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-blue-500" />
            Dates with scheduled deliveries
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { dashboardQuery } = useDashboard();
  const revenueData = dashboardQuery.data?.monthly_revenue ?? [];
  const currentRevenue = dashboardQuery.data?.revenue ?? 0;
  const dailySalesData = dashboardQuery.data?.daily_sales ?? [];
  const topProducts = dashboardQuery.data?.top_selling_products ?? [];
  const topCustomers = dashboardQuery.data?.top_customers ?? [];
  const activeDeliveries = dashboardQuery.data?.active_deliveries ?? [];
  const upcomingDeliveries = dashboardQuery.data?.upcoming_deliveries ?? [];
  const deliveryCalendar = dashboardQuery.data?.delivery_calendar ?? [];
  const dailySalesTotal = dailySalesData.reduce(
    (total: number, item: { sales: number }) => total + Number(item.sales),
    0,
  );

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Page header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">HYOps / Overview</p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              Dashboard
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Monitor inventory, sales, orders, and deliveries in one place.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Search">
              <Search className="size-4" />
            </Button>

            <Button variant="outline" size="icon" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>

            <Button>
              <CalendarDays className="mr-2 size-4" />
              October 2026
            </Button>
          </div>
        </header>

        {/* Stat cards */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard />
        </section>

        {/* Big map + calendar */}
        <section className="grid gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-8">
            <Map center={[-74.006, 40.7128]} zoom={12} />
          </Card>

          <div className="xl:col-span-4">
            <CalendarWidget events={deliveryCalendar} />
          </div>
        </section>

        {/* Revenue overview + active deliveries */}
        <section className="grid gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-7">
            <CardHeader>
              <SectionHeading
                title="Revenue Overview"
                description="Monthly revenue for the last six months"
                action={<Badge variant="outline">Last six months</Badge>}
              />
            </CardHeader>

            <CardContent>
              <RevenueOverview />
            </CardContent>
          </Card>

          <Card className="xl:col-span-5">
            <CardHeader>
              <SectionHeading
                title="Active Deliveries"
                description="Current and scheduled delivery runs"
                action={
                  <Button variant="ghost" size="sm">
                    View all
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                }
              />
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-3 pr-3 font-medium">Run / Customer</th>
                      <th className="pb-3 pr-3 font-medium">Driver</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {activeDeliveries.map((delivery) => (
                      <tr key={delivery.run} className="border-b last:border-0">
                        <td className="py-4 pr-3">
                          <p className="font-semibold">{delivery.run}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {delivery.customer}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {delivery.progress}
                          </p>
                        </td>

                        <td className="py-4 pr-3">
                          <p className="whitespace-nowrap text-xs">
                            {delivery.driver}
                          </p>
                          <p className="mt-1 max-w-[140px] text-xs text-muted-foreground">
                            {delivery.destination}
                          </p>
                        </td>

                        <td className="py-4">
                          <StatusBadge status={delivery.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-blue-600" />
                  <p className="text-sm font-medium">Delivery operations</p>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Run status and stop progress should refresh as your driver app
                  submits updates.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Daily sales, upcoming deliveries, recent activity */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Daily sales */}
          <Card>
            <CardHeader>
              <SectionHeading
                title="Daily Sales"
                description="Sales totals over the last seven days"
                action={<Wallet className="size-5 text-muted-foreground" />}
              />
            </CardHeader>

            <CardContent>
              <div className="mb-5">
                <p className="text-2xl font-bold">
                  {formatCurrency(dailySalesTotal)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Total sales for the last seven days
                </p>
              </div>

              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailySalesData}
                    margin={{ top: 8, right: 0, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickFormatter={(value) =>
                        `${Math.round(Number(value) / 1000)}k`
                      }
                    />

                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "Sales",
                      ]}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                      }}
                    />

                    <Bar
                      dataKey="sales"
                      fill="#0d9488"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming deliveries */}
          <Card>
            <CardHeader>
              <SectionHeading
                title="Upcoming Deliveries"
                description="Next scheduled delivery runs"
                action={
                  <CalendarClock className="size-5 text-muted-foreground" />
                }
              />
            </CardHeader>

            <CardContent className="space-y-4">
              {upcomingDeliveries.length > 0 ? (
                upcomingDeliveries.map((delivery) => {
                  const deliveryDate = new Date(`${delivery.date}T00:00:00`);
                  const [hours, minutes] = delivery.time
                    .split(":")
                    .map(Number);
                  const timeLabel = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(
                    "en-US",
                    { hour: "numeric", minute: "2-digit" },
                  );

                  return (
                    <div key={delivery.run} className="flex gap-3">
                      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/30 p-2">
                        <span className="text-xs text-muted-foreground">
                          {deliveryDate.toLocaleDateString("en-US", {
                            month: "short",
                          })}
                        </span>
                        <span className="text-xl font-bold">
                          {deliveryDate.getDate()}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold">
                            {delivery.customer}
                          </p>

                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px]"
                          >
                            {delivery.run}
                          </Badge>
                        </div>

                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="size-3.5" />
                          {timeLabel}
                        </p>

                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" />
                          <span className="truncate">{delivery.destination}</span>
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Driver: {delivery.driver}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed p-5 text-center">
                  <CalendarClock className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">
                    No upcoming deliveries scheduled
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    New scheduled delivery runs will appear here.
                  </p>
                </div>
              )}

              <Button variant="outline" className="w-full">
                View delivery schedule
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader>
              <SectionHeading
                title="Recent Activity"
                description="Latest changes in HYOps"
                action={<Activity className="size-5 text-muted-foreground" />}
              />
            </CardHeader>

            <CardContent>
              <div className="space-y-5">
                {recentActivity.map((activity) => {
                  const Icon = activity.icon;

                  return (
                    <div key={activity.title} className="flex gap-3">
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${activity.color}`}
                      >
                        <Icon className="size-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-5">
                          {activity.title}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {activity.detail}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button variant="ghost" className="mt-4 w-full">
                View activity history
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Top products + most orders by customers */}
        <section className="grid gap-4 xl:grid-cols-2">
          {/* Top-selling products */}
          <Card>
            <CardHeader>
              <SectionHeading
                title="Top Selling Products"
                description="Best-performing product variants by quantity sold"
                action={<Boxes className="size-5 text-muted-foreground" />}
              />
            </CardHeader>

            <CardContent>
              <div className="space-y-5">
                {topProducts.map((product, index) => (
                  <div key={product.sku} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Package className="size-4 text-muted-foreground" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {product.sku}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {product.sold.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">units</p>
                      </div>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          index === 0 ? "bg-blue-600" : "bg-blue-500/70"
                        }`}
                        style={{ width: `${product.percent}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Sales contribution</span>
                      <span>{formatCurrency(product.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Most orders by customers */}
          <Card>
            <CardHeader>
              <SectionHeading
                title="Most Orders by Customers"
                description="Customers ranked by number of orders"
                action={<Users className="size-5 text-muted-foreground" />}
              />
            </CardHeader>

            <CardContent>
              <div className="space-y-5">
                {topCustomers.map((customer, index) => (
                  <div key={customer.name} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {customer.name}
                        </p>

                        <p className="truncate text-xs text-muted-foreground">
                          {customer.location}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {customer.orders} orders
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(customer.amount)}
                        </p>
                      </div>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${customer.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />

                  <p className="text-sm font-medium">Customer insights</p>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Use this ranking to identify your most frequent customers and
                  prioritize customer account reviews.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <footer className="pb-2 pt-1 text-center text-xs text-muted-foreground">
          HYOps Dashboard · Mock data for UI development
        </footer>
      </div>
    </main>
  );
}
