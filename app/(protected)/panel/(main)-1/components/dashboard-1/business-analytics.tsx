"use client";

import { useState } from "react";
import Link from "next/link";
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
  Award,
  BarChart3,
  Boxes,
  Calendar,
  CircleDollarSign,
  Crown,
  ExternalLink,
  MapPin,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/utils/date-util";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Product = {
  name: string;
  sku: string;
  sold: number;
  revenue: number | null;
  percent: number;
};

type Customer = {
  name: string;
  location: string;
  orders: number;
  amount: number | null;
  percent: number;
};

type SalesDay = {
  day: string;
  sales: number;
};

type MonthlyRevenue = {
  month: string;
  revenue: number;
};

function formatCompactPHP(value: number) {
  if (!Number.isFinite(value)) return "₱0";
  if (Math.abs(value) >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `₱${Math.round(value / 1_000)}k`;
  return `₱${value.toFixed(0)}`;
}

export function BusinessAnalytics({
  monthlyRevenue = [],
  dailySales = [],
  currentRevenue = 0,
  topProducts = [],
  topCustomers = [],
}: {
  monthlyRevenue: MonthlyRevenue[];
  dailySales: SalesDay[];
  currentRevenue: number;
  topProducts: Product[];
  topCustomers: Customer[];
}) {
  const [cashflowTab, setCashflowTab] = useState<"monthly" | "daily">("monthly");

  const dailySalesTotal =
    dailySales.reduce(
      (total, item) => total + Math.round(Number(item.sales) * 100),
      0
    ) / 100;

  return (
    <section aria-labelledby="business-analytics-heading" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2
              id="business-analytics-heading"
              className="text-lg font-bold tracking-tight"
            >
              Business & Revenue Intelligence
            </h2>
            <Badge variant="secondary" className="h-5 text-xs font-normal">
              Philippine Pesos (PHP)
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Cash movements, product sales distribution, and customer purchase trends
          </p>
        </div>

        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          className="h-8 text-xs font-medium self-start sm:self-auto"
          render={<Link href="/panel/analysis-reports" />}
        >
          <BarChart3 className="mr-1.5 size-3.5" />
          Full Financial Reports
        </Button>
      </div>

      {/* Main Grid: Cashflow Chart + Product & Customer Rankings */}
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        {/* Cashflow Trends Card with Tab Switcher */}
        <Card className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs lg:col-span-2 xl:col-span-1">
          <CardHeader className="border-b bg-muted/20 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    Net Cashflow Dynamics
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Receipts minus customer refunds over time
                  </p>
                </div>
              </div>

              {/* View toggle */}
              <div className="inline-flex rounded-lg border bg-muted/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setCashflowTab("monthly")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    cashflowTab === "monthly"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calendar className="size-3" />
                  Monthly (6M)
                </button>
                <button
                  type="button"
                  onClick={() => setCashflowTab("daily")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    cashflowTab === "daily"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <BarChart3 className="size-3" />
                  Daily (7D)
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-5">
            {cashflowTab === "monthly" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      Current Month Net Cashflow
                    </span>
                    <p className="text-2xl font-bold tracking-tight tabular-nums">
                      {formatCurrency(Number(currentRevenue))}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Last 6 Manila Months
                  </Badge>
                </div>

                <div className="h-[280px] w-full min-w-0">
                  {!monthlyRevenue.length ? (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No monthly revenue records available.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={monthlyRevenue}
                        margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="cashflowAreaGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--color-primary, #3b82f6)"
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--color-primary, #3b82f6)"
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke="var(--border)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickMargin={8}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={58}
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          tickFormatter={formatCompactPHP}
                        />
                        <Tooltip
                          formatter={(value) => [
                            formatCurrency(Number(value)),
                            "Net Cashflow",
                          ]}
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "var(--popover)",
                            color: "var(--popover-foreground)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            fontSize: "12px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="var(--color-primary, #2563eb)"
                          strokeWidth={2.5}
                          fill="url(#cashflowAreaGradient)"
                          activeDot={{ r: 5, strokeWidth: 2 }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      7-Day Net Cashflow Total
                    </span>
                    <p className="text-2xl font-bold tracking-tight tabular-nums">
                      {formatCurrency(dailySalesTotal)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Last 7 Manila Days
                  </Badge>
                </div>

                <div className="h-[280px] w-full min-w-0">
                  {!dailySales.length ? (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No daily cash movement recorded.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailySales}
                        margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
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
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickMargin={8}
                        />
                        <YAxis
                          width={54}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          tickFormatter={formatCompactPHP}
                        />
                        <Tooltip
                          formatter={(value) => [
                            formatCurrency(Number(value)),
                            "Daily Net",
                          ]}
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "var(--popover)",
                            color: "var(--popover-foreground)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            fontSize: "12px",
                          }}
                        />
                        <Bar
                          dataKey="sales"
                          fill="var(--color-primary, #3b82f6)"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={36}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products Card */}
        <Card className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs">
          <CardHeader className="border-b bg-muted/20 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Boxes className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    Top-Selling Products
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ranked by total quantity sold (non-cancelled)
                  </p>
                </div>
              </div>

              <Link
                href="/panel/products"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Catalog
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-5">
            {!topProducts.length ? (
              <div className="flex min-h-48 flex-col items-center justify-center text-center">
                <Boxes className="mb-2 size-8 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground">
                  No product sales ranked yet.
                </p>
              </div>
            ) : (
              <ol className="divide-y divide-border/60">
                {topProducts.slice(0, 5).map((product, index) => {
                  const isTopOne = index === 0;
                  const isTopTwo = index === 1;
                  const isTopThree = index === 2;

                  return (
                    <li
                      key={product.sku}
                      className="py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-start gap-3">
                        {/* Rank Badge */}
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            isTopOne
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40"
                              : isTopTwo
                              ? "bg-slate-300/40 text-slate-700 dark:text-slate-300 ring-1 ring-slate-400/40"
                              : isTopThree
                              ? "bg-amber-800/20 text-amber-800 dark:text-amber-400 ring-1 ring-amber-700/40"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isTopOne ? (
                            <Crown className="size-3.5 text-amber-500" />
                          ) : (
                            index + 1
                          )}
                        </span>

                        {/* Product details */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {product.name}
                          </p>
                          <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                            {product.sku}
                          </p>

                          {/* Progress bar */}
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/80 transition-all duration-300"
                              style={{
                                width: `${Math.max(
                                  4,
                                  Math.min(100, product.percent)
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Sold & Revenue */}
                        <div className="shrink-0 text-right">
                          <span className="text-xs font-bold tabular-nums">
                            {product.sold.toLocaleString()} units
                          </span>
                          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                            {product.revenue === null
                              ? "Unverified"
                              : formatCurrency(product.revenue)}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Top Customers Card */}
        <Card className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs lg:col-span-2">
          <CardHeader className="border-b bg-muted/20 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Users className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    Top Clients by Order Volume
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Highest frequency purchasing accounts (all-time non-cancelled)
                  </p>
                </div>
              </div>

              <Badge variant="outline" className="text-xs">
                {topCustomers.length} Top Accounts
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-5">
            {!topCustomers.length ? (
              <div className="flex min-h-36 flex-col items-center justify-center text-center">
                <Users className="mb-2 size-8 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground">
                  No customer order volume to rank yet.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topCustomers.slice(0, 6).map((customer, index) => {
                  const initials = customer.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={`${customer.name}-${index}`}
                      className="group flex flex-col justify-between rounded-xl border bg-muted/15 p-3.5 transition-all hover:border-primary/40 hover:bg-muted/30"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {initials || index + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {customer.name}
                            </p>
                            {index === 0 && (
                              <Award className="size-3.5 text-amber-500 shrink-0" />
                            )}
                          </div>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                            <MapPin className="size-2.5 shrink-0" />
                            <span className="truncate">{customer.location}</span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                        <Badge variant="secondary" className="h-5 text-[10px]">
                          {customer.orders.toLocaleString()} orders
                        </Badge>
                        <span className="font-semibold tabular-nums text-foreground">
                          {customer.amount === null
                            ? "Unverified"
                            : formatCurrency(customer.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
export default BusinessAnalytics;
