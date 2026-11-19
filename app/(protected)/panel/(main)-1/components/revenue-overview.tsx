import { formatCurrency } from "@/utils/date-util";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboard } from "../provider";

export default function RevenueOverview() {
  const { dashboardQuery } = useDashboard();
  const revenueData = dashboardQuery.data?.monthly_revenue ?? [];
  const currentRevenue = dashboardQuery.data?.revenue ?? 0;

  function formatCompactPHP(value: number) {
    if (!Number.isFinite(value)) {
      return "₱—";
    }

    if (Math.abs(value) >= 1_000_000) {
      return `₱${(value / 1_000_000).toFixed(1)}M`;
    }

    if (Math.abs(value) >= 1_000) {
      return `₱${Math.round(value / 1_000)}k`;
    }

    return `₱${value.toFixed(0)}`;
  }

  return (
    <>
      <div className="mb-4">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {formatCurrency(Number(currentRevenue))}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Receipts minus refunds this Manila month.</p>
      </div>

      <div className="h-[260px] min-w-0 w-full">
        {!revenueData.length ? <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">No monthly cashflow data available.</p> : revenueData.every((item: { revenue: number }) => item.revenue === 0) ? <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No net cash movement in each of the last six Manila months.</p> :
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={revenueData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
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
              width={58}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={formatCompactPHP}
            />

            <Tooltip
              formatter={(value) => [formatCurrency(Number(value)), "Net cashflow"]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
              }}
            />

            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#revenueGradient)"
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>}
      </div>
    </>
  );
}
