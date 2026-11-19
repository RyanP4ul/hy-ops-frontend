"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
import { formatCurrency } from "@/utils/date-util";

type MonthlyRevenue = { month: string; revenue: number };
type DailySale = { day: string; sales: number };
type TopProduct = {
  name: string;
  sku: string;
  sold: number;
  revenue: number | null;
  percent: number;
};
type TopCustomer = {
  name: string;
  location: string;
  orders: number;
  amount: number | null;
  percent: number;
};

function formatCompactPHP(value: number) {
  if (!Number.isFinite(value)) return "₱—";
  if (Math.abs(value) >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `₱${Math.round(value / 1_000)}k`;
  return `₱${value.toFixed(0)}`;
}

function SegmentedSwitch<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg bg-muted p-0.5"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={[
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              active
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function PerformanceSection({
  currentRevenue,
  monthlyRevenue,
  dailySales,
  topProducts,
  topCustomers,
}: {
  currentRevenue: number;
  monthlyRevenue: MonthlyRevenue[];
  dailySales: DailySale[];
  topProducts: TopProduct[];
  topCustomers: TopCustomer[];
}) {
  const [cashflowRange, setCashflowRange] = useState<"monthly" | "daily">(
    "monthly",
  );
  const [rankingTab, setRankingTab] = useState<"products" | "customers">(
    "products",
  );

  const dailySalesTotal =
    dailySales.reduce(
      (total, item) => total + Math.round(Number(item.sales) * 100),
      0,
    ) / 100;

  const monthlyEmpty = !monthlyRevenue.length;
  const monthlyAllZero =
    !monthlyEmpty && monthlyRevenue.every((item) => Number(item.revenue) === 0);
  const dailyEmpty = !dailySales.length;
  const dailyAllZero =
    !dailyEmpty && dailySales.every((item) => Number(item.sales) === 0);

  return (
    <section
      aria-label="Cashflow and rankings"
      className="grid min-w-0 gap-5 xl:grid-cols-12"
    >
      {/* Cashflow Card */}
      <div className="flex min-w-0 flex-col rounded-xl border bg-card xl:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-tight">
              Net cashflow
            </h2>
            <Link
              href="/panel/analysis-reports?tab=payments"
              className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              Reports
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>

          <SegmentedSwitch
            value={cashflowRange}
            onChange={setCashflowRange}
            ariaLabel="Cashflow period"
            options={[
              { value: "monthly", label: "6 months" },
              { value: "daily", label: "7 days" },
            ]}
          />
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {cashflowRange === "monthly"
                ? formatCurrency(Number(currentRevenue))
                : formatCurrency(dailySalesTotal)}
            </p>
            <span className="text-xs text-muted-foreground">
              {cashflowRange === "monthly"
                ? "Current month · PHP"
                : "Last 7 days · PHP"}
            </span>
          </div>

          <div className="h-[250px] w-full min-w-0">
            {cashflowRange === "monthly" ? (
              monthlyEmpty || monthlyAllZero ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {monthlyEmpty
                    ? "No monthly cashflow data yet."
                    : "No net cash movement in the last six months."}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyRevenue}
                    margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="d2CashflowFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--primary)"
                          stopOpacity={0.14}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--primary)"
                          stopOpacity={0}
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
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      tickMargin={10}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickFormatter={formatCompactPHP}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "Net cashflow",
                      ]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#d2CashflowFill)"
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )
            ) : dailyEmpty || dailyAllZero ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {dailyEmpty
                  ? "No daily cashflow data yet."
                  : "No net cash movement in the last seven days."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailySales}
                  margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
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
                    tickMargin={10}
                  />
                  <YAxis
                    width={56}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={formatCompactPHP}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      "Net cashflow",
                    ]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="sales"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Rankings Card */}
      <div className="flex min-w-0 flex-col rounded-xl border bg-card xl:col-span-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold tracking-tight">
            {rankingTab === "products" ? "Top products" : "Top customers"}
          </h2>

          <SegmentedSwitch
            value={rankingTab}
            onChange={setRankingTab}
            ariaLabel="Ranking view"
            options={[
              { value: "products", label: "Products" },
              { value: "customers", label: "Customers" },
            ]}
          />
        </div>

        <div className="flex flex-1 flex-col justify-between p-5">
          {rankingTab === "products" ? (
            !topProducts.length ? (
              <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
                No product sales yet.
              </div>
            ) : (
              <ol className="divide-y">
                {topProducts.map((product, index) => (
                  <li key={product.sku} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 w-4 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {product.name}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          {product.sku}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium tabular-nums text-foreground">
                          {product.sold.toLocaleString()} units
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          {product.revenue === null
                            ? "Unverified"
                            : formatCurrency(product.revenue)}
                        </p>
                      </div>
                    </div>
                    <div
                      aria-hidden="true"
                      className="mt-2 ml-7 h-1 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-primary/65"
                        style={{
                          width: `${Math.max(0, Math.min(100, product.percent))}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )
          ) : !topCustomers.length ? (
            <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
              No customer orders yet.
            </div>
          ) : (
            <ol className="divide-y">
              {topCustomers.map((customer, index) => (
                <li
                  key={`${customer.name}-${index}`}
                  className="py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-4 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {customer.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {customer.location}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums text-foreground">
                        {customer.orders.toLocaleString()}{" "}
                        {customer.orders === 1 ? "order" : "orders"}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {customer.amount === null
                          ? "Unverified"
                          : formatCurrency(customer.amount)}
                      </p>
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="mt-2 ml-7 h-1 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-primary/65"
                      style={{
                        width: `${Math.max(0, Math.min(100, customer.percent))}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              Non-cancelled orders
            </span>
            <Link
              href={
                rankingTab === "products" ? "/panel/products" : "/panel/orders"
              }
              className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {rankingTab === "products" ? "Products" : "Orders"}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
