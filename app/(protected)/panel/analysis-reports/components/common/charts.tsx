import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import type { Point } from "../../api/contract";
import { CHART_COLORS as C } from "../../constants";
import { label as pretty, peso } from "../../lib/format";

type Fmt = (n: number) => string;
const short = (s: string) => (s.length > 12 ? `${s.slice(0, 11)}…` : s);

// These return the chart element only; wrap them in <ChartCard>, which supplies the ResponsiveContainer.
export const barsChart = (data: Point[], fmt: Fmt = String, tooltipFmt: Fmt = fmt) => (
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey="name" fontSize={11} tickFormatter={short} />
    <YAxis fontSize={11} tickFormatter={fmt} />
    <RTooltip formatter={(v) => typeof v === "number" && Number.isFinite(v) ? tooltipFmt(v) : "Unavailable"} />
    <Bar dataKey="value" fill={C[0]} radius={[3, 3, 0, 0]} />
  </BarChart>
);

export const pieChart = (data: Point[]) => (
  <PieChart>
    <Pie data={data.map((d) => ({ ...d, name: pretty(d.name) }))} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
      {data.map((_, i) => <Cell key={i} fill={C[i % 5]} />)}
    </Pie>
    <Legend />
    <RTooltip />
  </PieChart>
);

export const lineChart = (data: Point[], fmt: Fmt, tooltipFmt: Fmt = fmt) => (
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey="name" fontSize={11} />
    <YAxis fontSize={11} tickFormatter={fmt} />
    <RTooltip formatter={(v) => typeof v === "number" && Number.isFinite(v) ? tooltipFmt(v) : "Unavailable"} />
    <Line dataKey="value" stroke={C[0]} dot={false} strokeWidth={2} />
  </LineChart>
);

export const stackedStockChart = (data: { name: string; Available: number; Reserved: number }[]) => (
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey="name" fontSize={11} />
    <YAxis fontSize={11} />
    <RTooltip />
    <Legend />
    <Bar dataKey="Available" stackId="s" fill={C[0]} />
    <Bar dataKey="Reserved" stackId="s" fill={C[2]} />
  </BarChart>
);
