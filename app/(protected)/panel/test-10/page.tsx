"use client";
// Analysis & Reports — UI-only phase (mock data). Place at app/(admin)/analysis-reports/page.tsx
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CircleDollarSign,
  FileText,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Truck,
  Wallet,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CATEGORIES,
  CUSTOMERS,
  ORDERS,
  PRODUCTS,
  TODAY,
  VEHICLES,
  WAREHOUSES,
  type Order,
} from "./mock-data";

const ymd = (d: Date) => d.toLocaleDateString("en-CA"); // local YYYY-MM-DD
const peso = (n: number) => `₱${Math.round(n).toLocaleString("en-PH")}`;
const C = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const PRESETS: Record<string, number> = {
  today: 0,
  "7d": 7,
  "30d": 30,
  month: 30,
  "90d": 90,
  year: 365,
};
const PRESET_LABELS: Record<string, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "Last 30 days (month)",
  "90d": "Last 90 days",
  year: "This year",
  custom: "Custom range",
};
const ALL = "all";
type Filters = {
  preset: string;
  customer: string;
  product: string;
  category: string;
  arrangement: string;
  payStatus: string;
  deliveryStatus: string;
  deliveryType: string;
  vehicle: string;
  from: string;
  to: string;
};
const DEFAULTS: Filters = {
  preset: "90d",
  customer: ALL,
  product: ALL,
  category: ALL,
  arrangement: ALL,
  payStatus: ALL,
  deliveryStatus: ALL,
  deliveryType: ALL,
  vehicle: ALL,
  from: "",
  to: "",
};

const isCustom = (f: Filters) => f.preset === "custom" && !!f.from && !!f.to;
const spanDays = (f: Filters) =>
  isCustom(f)
    ? Math.round(
        (new Date(f.to).getTime() - new Date(f.from).getTime()) / 864e5,
      ) + 1
    : Math.max(PRESETS[f.preset] ?? 30, 1);

function applyFilters(f: Filters, offsetDays = 0) {
  const base = isCustom(f)
    ? new Date(f.to + "T00:00:00+08:00").getTime()
    : TODAY.getTime();
  const end = base - offsetDays * 864e5;
  const start = end - spanDays(f) * 864e5;
  return ORDERS.filter((o) => {
    const t = new Date(o.date).getTime();
    return (
      t > start &&
      t <= end + 864e5 &&
      (f.customer === ALL || o.customer === f.customer) &&
      (f.product === ALL || o.product === f.product) &&
      (f.category === ALL || o.category === f.category) &&
      (f.arrangement === ALL || o.arrangement === f.arrangement) &&
      (f.payStatus === ALL || o.payStatus === f.payStatus) &&
      (f.deliveryStatus === ALL || o.deliveryStatus === f.deliveryStatus) &&
      (f.deliveryType === ALL || o.deliveryType === f.deliveryType) &&
      (f.vehicle === ALL || o.vehicle === f.vehicle)
    );
  });
}
const sum = (a: Order[], k: (o: Order) => number) =>
  a.reduce((s, o) => s + k(o), 0);
const groupSum = (
  a: Order[],
  key: (o: Order) => string,
  val: (o: Order) => number,
) => {
  const m = new Map<string, number>();
  a.forEach((o) => m.set(key(o), (m.get(key(o)) ?? 0) + val(o)));
  return [...m].map(([name, value]) => ({ name, value }));
};
function metrics(all: Order[]) {
  const live = all.filter((o) => o.orderStatus !== "CANCELLED"); // cancelled excluded from sales metrics
  const attempted = live.filter(
    (o) => o.deliveryStatus === "COMPLETED" || o.deliveryStatus === "FAILED",
  );
  const failed = attempted.filter((o) => o.deliveryStatus === "FAILED").length;
  const overdue = live.filter((o) => o.payStatus === "OVERDUE");
  return {
    live,
    revenue: sum(live, (o) => o.total),
    orders: live.length,
    collected: sum(live, (o) => o.paid),
    outstanding: sum(live, (o) => o.total - o.paid),
    overdue: sum(overdue, (o) => o.total - o.paid),
    completed: attempted.length - failed,
    failed,
    failRate: attempted.length ? (failed / attempted.length) * 100 : 0,
    aov: live.length ? sum(live, (o) => o.total) / live.length : 0,
    avgDuration: attempted.length
      ? sum(attempted, (o) => o.durationMin) / attempted.length
      : 0,
  };
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  icon: any;
  delta?: number | null;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className="text-2xl font-semibold">{value}</div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {delta != null && (
            <span className={delta >= 0 ? "text-emerald-600" : "text-red-600"}>
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}%{" "}
            </span>
          )}
          {hint}
        </p>
      </CardContent>
    </Card>
  );
}
const Chart = ({
  title,
  description,
  children,
  loading,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  loading: boolean;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    <CardContent className="h-64">
      {loading ? (
        <Skeleton className="h-full w-full" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);
const badgeTone = (s: string) =>
  (["PAID", "COMPLETED"].includes(s)
    ? "default"
    : ["OVERDUE", "FAILED", "CANCELLED"].includes(s)
      ? "destructive"
      : "secondary") as any;
const Status = ({ s }: { s: string }) => (
  <Badge variant={badgeTone(s)}>{s.replace("_", " ")}</Badge>
);

function trend(
  rows: Order[],
  grain: "day" | "week" | "month",
  val: (o: Order) => number,
) {
  const key = (d: string) =>
    grain === "month"
      ? d.slice(0, 7)
      : grain === "week"
        ? (() => {
            const x = new Date(d);
            x.setDate(x.getDate() - x.getDay());
            return x.toISOString().slice(0, 10);
          })()
        : d;
  return groupSum(rows, (o) => key(o.date), val).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function OrdersTable({ rows }: { rows: Order[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [desc, setDesc] = useState(true);
  const filtered = useMemo(
    () =>
      rows
        .filter((o) =>
          `${o.number} ${o.customer}`.toLowerCase().includes(q.toLowerCase()),
        )
        .sort((a, b) => (desc ? b.total - a.total : a.total - b.total)),
    [rows, q, desc],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  return (
    <Card>
      <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Orders</CardTitle>
        <Input
          className="sm:w-64"
          placeholder="Search order or customer"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>
                <button className="font-medium" onClick={() => setDesc(!desc)}>
                  Total {desc ? "↓" : "↑"}
                </button>
              </TableHead>
              <TableHead>Arrangement</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(page * 8, page * 8 + 8).map((o) => (
              <TableRow key={o.id}>
                <TableCell>{o.number}</TableCell>
                <TableCell>{o.date}</TableCell>
                <TableCell>{o.customer}</TableCell>
                <TableCell>{peso(o.total)}</TableCell>
                <TableCell>{o.arrangement.replace("_", " ")}</TableCell>
                <TableCell>
                  <Status s={o.payStatus} />
                </TableCell>
                <TableCell>
                  <Status s={o.orderStatus} />
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No orders match these filters. Reset filters or widen the date
                  range.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>{filtered.length} orders</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>
              {page + 1} / {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={(value) => { if (value !== null) onChange(value); }}>
      <SelectTrigger className="w-full sm:w-44" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: all</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
const opts = (a: string[]): [string, string][] =>
  a.map((x) => [x, x.replace("_", " ")]);

const REPORT_TYPES = [
  "Sales",
  "Inventory",
  "Payment",
  "Delivery",
  "Customer",
] as const;

export default function AnalysisReportsPage() {
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [grain, setGrain] = useState<"day" | "week" | "month">("week");
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [wh, setWh] = useState(ALL);
  const [cust, setCust] = useState<string | null>(null);
  const [dlg, setDlg] = useState(false);
  const [rType, setRType] = useState<(typeof REPORT_TYPES)[number]>("Sales");
  const [rFormat, setRFormat] = useState("PDF");
  const [preview, setPreview] = useState<null | "loading" | "ready">(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const set = (k: keyof Filters) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));
  const periodLabel = isCustom(f)
    ? `${f.from} to ${f.to}`
    : PRESET_LABELS[f.preset];

  const rows = useMemo(() => applyFilters(f), [f]);
  const prev = useMemo(() => applyFilters(f, spanDays(f)), [f]);
  const m = metrics(rows);
  const pm = metrics(prev);
  const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);
  const refresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 700);
  };
  const activeFilters = (Object.entries(f) as [keyof Filters, string][]).filter(
    ([k, v]) => !["preset", "from", "to"].includes(k) && v !== ALL,
  );

  const revenueTrend = trend(m.live, grain, (o) => o.total);
  const ordersTrend = trend(rows, grain, () => 1);
  const payBreakdown = groupSum(
    m.live,
    (o) => o.payStatus,
    (o) => o.total - o.paid + (o.payStatus === "PAID" ? o.total : 0),
  );
  const byCategory = groupSum(
    m.live,
    (o) => o.category,
    (o) => o.total,
  );
  const byCustomer = groupSum(
    m.live,
    (o) => o.customer,
    (o) => o.total,
  ).sort((a, b) => b.value - a.value);
  const byProductQty = groupSum(
    m.live,
    (o) => o.product,
    (o) => o.qty,
  ).sort((a, b) => b.value - a.value);
  const aging = (() => {
    const b = {
      "Not yet due": 0,
      "1–30 days": 0,
      "31–60 days": 0,
      "61–90 days": 0,
      "90+ days": 0,
    } as Record<string, number>;
    m.live
      .filter((o) => o.total > o.paid)
      .forEach((o) => {
        const d = Math.floor(
          (TODAY.getTime() - new Date(o.dueDate).getTime()) / 864e5,
        );
        b[
          d <= 0
            ? "Not yet due"
            : d <= 30
              ? "1–30 days"
              : d <= 60
                ? "31–60 days"
                : d <= 90
                  ? "61–90 days"
                  : "90+ days"
        ] += o.total - o.paid;
      });
    return Object.entries(b).map(([name, value]) => ({ name, value }));
  })();
  const byType = groupSum(
    rows.filter((o) => o.deliveryStatus !== "CANCELLED"),
    (o) => o.deliveryType,
    () => 1,
  );
  const byVehicle = groupSum(
    rows.filter((o) => o.vehicle !== "—"),
    (o) => o.vehicle,
    () => 1,
  );
  const customers = CUSTOMERS.map((c) => {
    const r = m.live.filter((o) => o.customer === c);
    return {
      c,
      n: r.length,
      sales: sum(r, (o) => o.total),
      paid: sum(r, (o) => o.paid),
      bal: sum(r, (o) => o.total - o.paid),
      last: r[0]?.date ?? "—",
    };
  }).filter((x) => x.n);

  const bars = (
    data: { name: string; value: number }[],
    fmt = (n: number) => String(n),
  ) => (
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="name" fontSize={11} />
      <YAxis fontSize={11} tickFormatter={fmt} />
      <RTooltip formatter={(v) => typeof v === "number" && Number.isFinite(v) ? fmt(v) : "Not recorded"} />
      <Bar dataKey="value" fill={C[0]} radius={[3, 3, 0, 0]} />
    </BarChart>
  );
  const pie = (data: { name: string; value: number }[]) => (
    <PieChart>
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        innerRadius={45}
        outerRadius={80}
      >
        {data.map((_, i) => (
          <Cell key={i} fill={C[i % 5]} />
        ))}
      </Pie>
      <Legend />
      <RTooltip />
    </PieChart>
  );
  const share = wh === ALL ? 1 : wh === WAREHOUSES[0] ? 0.6 : 0.4; // MOCK split of stock between warehouses
  const inv = PRODUCTS.map((p) => ({
    ...p,
    stock: Math.round(p.stock * share),
    reserved: Math.round(p.reserved * share),
    threshold: Math.round(p.threshold * share),
  }));
  const whLabel = wh === ALL ? "All warehouses" : wh;
  const lowStock = inv.filter((p) => p.stock - p.reserved < p.threshold);
  const SLOW_UNITS = 10;
  const soldQty = new Map(byProductQty.map((x) => [x.name, x.value]));
  const slow = inv
    .map((p) => ({
      ...p,
      sold: soldQty.get(p.name) ?? 0,
      last:
        ORDERS.find(
          (o) => o.product === p.name && o.orderStatus !== "CANCELLED",
        )?.date ?? "—",
    }))
    .filter((p) => p.sold <= SLOW_UNITS);
  const stockData = inv.map((p) => ({
    name: p.sku,
    Available: p.stock - p.reserved,
    Reserved: p.reserved,
  }));

  const generate = () => {
    setExportMsg(null);
    setPreview("loading");
    setTimeout(() => setPreview("ready"), 900);
  };
  const closeDialog = () => {
    setDlg(false);
    setPreview(null);
    setExportMsg(null);
  };
  const summary: Record<string, [string, string][]> = {
    Sales: [
      ["Sales revenue", peso(m.revenue)],
      ["Orders", String(m.orders)],
      ["Average order value", peso(m.aov)],
    ],
    Inventory: [
      ["Active products", String(PRODUCTS.length)],
      ["Low stock", String(lowStock.length)],
      ["Out of stock", String(inv.filter((p) => !p.stock).length)],
    ],
    Payment: [
      ["Collected", peso(m.collected)],
      ["Outstanding", peso(m.outstanding)],
      ["Overdue", peso(m.overdue)],
    ],
    Delivery: [
      ["Completed", String(m.completed)],
      ["Failed", String(m.failed)],
      ["Failure rate", `${m.failRate.toFixed(1)}%`],
    ],
    Customer: [
      ["Customers with orders", String(customers.length)],
      ["Total sales", peso(m.revenue)],
      ["Outstanding", peso(m.outstanding)],
    ],
  };
  const rowCount =
    rType === "Inventory"
      ? PRODUCTS.length
      : rType === "Customer"
        ? customers.length
        : rType === "Delivery"
          ? rows.filter((o) => o.deliveryStatus !== "CANCELLED").length
          : rows.length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analysis &amp; Reports</h1>
          <p className="text-sm text-muted-foreground">
            Analyze sales, inventory, payments, deliveries, and customer
            performance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={f.preset} onValueChange={(value) => { if (value !== null) set("preset")(value); }}>
            <SelectTrigger className="w-44" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRESET_LABELS)
                .filter(([k]) => k !== "month")
                .map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {f.preset === "custom" && (
            <Popover>
              <PopoverTrigger render={
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {f.from && f.to
                    ? `${f.from} to ${f.to}`
                    : f.from
                      ? "Pick an end date"
                      : "Pick dates"}
                </Button>
              } />
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  disabled={{ after: new Date() }}
                  selected={
                    f.from
                      ? {
                          from: new Date(f.from + "T00:00:00"),
                          to: f.to ? new Date(f.to + "T00:00:00") : undefined,
                        }
                      : undefined
                  }
                  onSelect={(r) =>
                    setF((p) => ({
                      ...p,
                      from: r?.from ? ymd(r.from) : "",
                      to: r?.to ? ymd(r.to) : "",
                    }))
                  }
                />
              </PopoverContent>
            </Popover>
          )}
          <Button variant="outline" onClick={() => setF(DEFAULTS)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset filters
          </Button>
          <Button variant="outline" onClick={refresh}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button onClick={() => setDlg(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? "Hide" : "Show"} filters
        </Button>
        <div
          className={`${showFilters ? "grid" : "hidden"} grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap`}
        >
          <FilterSelect
            label="Product"
            value={f.product}
            onChange={set("product")}
            options={PRODUCTS.map((p) => [p.name, p.name])}
          />
          <FilterSelect
            label="Category"
            value={f.category}
            onChange={set("category")}
            options={opts(CATEGORIES)}
          />
          <FilterSelect
            label="Customer"
            value={f.customer}
            onChange={set("customer")}
            options={opts(CUSTOMERS)}
          />
          <FilterSelect
            label="Arrangement"
            value={f.arrangement}
            onChange={set("arrangement")}
            options={opts(["FULLY_PAID", "PARTIALLY_PAID", "NET_30"])}
          />
          <FilterSelect
            label="Payment status"
            value={f.payStatus}
            onChange={set("payStatus")}
            options={opts(["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE"])}
          />
          <FilterSelect
            label="Delivery status"
            value={f.deliveryStatus}
            onChange={set("deliveryStatus")}
            options={opts(["SCHEDULED", "COMPLETED", "FAILED", "CANCELLED"])}
          />
          <FilterSelect
            label="Delivery type"
            value={f.deliveryType}
            onChange={set("deliveryType")}
            options={opts(["INTERNAL", "LALAMOVE", "PICKUP"])}
          />
          <FilterSelect
            label="Vehicle"
            value={f.vehicle}
            onChange={set("vehicle")}
            options={opts(VEHICLES)}
          />
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activeFilters.map(([k, v]) => (
              <Badge key={k} variant="secondary">
                {k}: {v.replace("_", " ")}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Sample data</AlertTitle>
        <AlertDescription>
          Figures shown are mock data for UI testing. Revenue counts
          non-cancelled orders by order date (Asia/Manila).
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          {[
            "overview",
            "sales",
            "inventory",
            "payments",
            "deliveries",
            "customers",
          ].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi
              loading={loading}
              label="Sales revenue"
              value={peso(m.revenue)}
              delta={delta(m.revenue, pm.revenue)}
              hint="vs previous period"
              icon={CircleDollarSign}
            />
            <Kpi
              loading={loading}
              label="Total orders"
              value={String(m.orders)}
              delta={delta(m.orders, pm.orders)}
              hint="non-cancelled"
              icon={ShoppingCart}
            />
            <Kpi
              loading={loading}
              label="Payments collected"
              value={peso(m.collected)}
              hint="recorded payments"
              icon={Wallet}
            />
            <Kpi
              loading={loading}
              label="Outstanding balance"
              value={peso(m.outstanding)}
              hint="total minus payments"
              icon={Scale}
            />
            <Kpi
              loading={loading}
              label="Completed deliveries"
              value={String(m.completed)}
              hint="in period"
              icon={PackageCheck}
            />
            <Kpi
              loading={loading}
              label="Delivery failure rate"
              value={`${m.failRate.toFixed(1)}%`}
              hint="of attempted"
              icon={Truck}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            Group by
            <Select value={grain} onValueChange={(v) => setGrain(v as any)}>
              <SelectTrigger className="w-28" aria-label="Grouping">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Chart
              loading={loading}
              title="Revenue trend"
              description="Order value by order date"
            >
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(n) => `${n / 1000}k`} />
                <RTooltip formatter={(v) => typeof v === "number" && Number.isFinite(v) ? peso(v) : "Not recorded"} />
                <Line
                  dataKey="value"
                  stroke={C[0]}
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </Chart>
            <Chart
              loading={loading}
              title="Orders overview"
              description="Orders created (count)"
            >
              {bars(ordersTrend)}
            </Chart>
            <Chart
              loading={loading}
              title="Payment status breakdown"
              description="Showing order counts"
            >
              {pie(
                groupSum(
                  m.live,
                  (o) => o.payStatus,
                  () => 1,
                ),
              )}
            </Chart>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Recent business activity
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Ref</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 5).map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>{o.date}</TableCell>
                        <TableCell>{o.number}</TableCell>
                        <TableCell>{o.customer}</TableCell>
                        <TableCell>Order</TableCell>
                        <TableCell>
                          <Status s={o.orderStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              loading={loading}
              label="Total sales"
              value={peso(m.revenue)}
              hint=""
              icon={CircleDollarSign}
            />
            <Kpi
              loading={loading}
              label="Orders"
              value={String(m.orders)}
              hint=""
              icon={ShoppingCart}
            />
            <Kpi
              loading={loading}
              label="Average order value"
              value={peso(m.aov)}
              hint=""
              icon={Scale}
            />
            <Kpi
              loading={loading}
              label="Growth"
              value={`${(delta(m.revenue, pm.revenue) ?? 0).toFixed(1)}%`}
              hint="vs previous period"
              icon={Wallet}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Chart loading={loading} title="Sales by category">
              {bars(byCategory, (n) => `${n / 1000}k`)}
            </Chart>
            <Chart loading={loading} title="Revenue by customer">
              {bars(byCustomer, (n) => `${n / 1000}k`)}
            </Chart>
          </div>
          <OrdersTable rows={rows} />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={wh} onValueChange={(value) => { if (value !== null) setWh(value); }}>
              <SelectTrigger className="w-full sm:w-52" aria-label="Warehouse">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All warehouses</SelectItem>
                {WAREHOUSES.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Alert className="flex-1">
              <AlertTitle>
                Showing{" "}
                {wh === ALL
                  ? `combined quantities for ${WAREHOUSES.join(" + ")}`
                  : `quantities for ${wh} only`}
              </AlertTitle>
              <AlertDescription>
                Available = on hand minus reserved for open orders. Warehouse
                split is sample data.
              </AlertDescription>
            </Alert>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              loading={loading}
              label="Active products"
              value={String(PRODUCTS.length)}
              hint=""
              icon={PackageCheck}
            />
            <Kpi
              loading={loading}
              label="Low stock"
              value={String(lowStock.length)}
              hint="available below threshold"
              icon={AlertTriangle}
            />
            <Kpi
              loading={loading}
              label="Out of stock"
              value={String(inv.filter((p) => !p.stock).length)}
              hint=""
              icon={AlertTriangle}
            />
            <Kpi
              loading={loading}
              label="Units on hand"
              value={String(inv.reduce((s, p) => s + p.stock, 0))}
              hint={whLabel}
              icon={Scale}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Chart
              loading={loading}
              title="Top sellers by units sold"
              description="Selected period"
            >
              {bars(byProductQty)}
            </Chart>
            <Chart
              loading={loading}
              title="Stock by product"
              description={`Available vs reserved — ${whLabel}`}
            >
              <BarChart data={stockData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip />
                <Legend />
                <Bar dataKey="Available" stackId="s" fill={C[0]} />
                <Bar dataKey="Reserved" stackId="s" fill={C[2]} />
              </BarChart>
            </Chart>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Low-stock products</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Reserved</TableHead>
                    <TableHead>Reorder at</TableHead>
                    <TableHead>Warehouse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((p) => (
                    <TableRow key={p.sku}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.sku}</TableCell>
                      <TableCell>{p.stock - p.reserved}</TableCell>
                      <TableCell>{p.reserved}</TableCell>
                      <TableCell>{p.threshold}</TableCell>
                      <TableCell>{whLabel}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Slow-moving products</CardTitle>
              <CardDescription>
                {SLOW_UNITS} or fewer units sold in the selected period (
                {periodLabel}).
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Current stock ({whLabel})</TableHead>
                    <TableHead>Last movement</TableHead>
                    <TableHead>Units sold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slow.map((p) => (
                    <TableRow key={p.sku}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.sku}</TableCell>
                      <TableCell>{p.stock}</TableCell>
                      <TableCell>{p.last}</TableCell>
                      <TableCell>{p.sold}</TableCell>
                    </TableRow>
                  ))}
                  {!slow.length && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-6 text-center text-muted-foreground"
                      >
                        No slow-moving products in this period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              loading={loading}
              label="Payments collected"
              value={peso(m.collected)}
              hint=""
              icon={Wallet}
            />
            <Kpi
              loading={loading}
              label="Outstanding balance"
              value={peso(m.outstanding)}
              hint=""
              icon={Scale}
            />
            <Kpi
              loading={loading}
              label="Overdue balance"
              value={peso(m.overdue)}
              hint="past due date with balance"
              icon={AlertTriangle}
            />
            <Kpi
              loading={loading}
              label="Partially paid orders"
              value={String(
                m.live.filter((o) => o.paid > 0 && o.paid < o.total).length,
              )}
              hint=""
              icon={CircleDollarSign}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Chart
              loading={loading}
              title="Payment arrangement"
              description="Order counts"
            >
              {pie(
                groupSum(
                  m.live,
                  (o) => o.arrangement,
                  () => 1,
                ),
              )}
            </Chart>
            <Chart
              loading={loading}
              title="Accounts receivable aging"
              description="Outstanding balance by days past due"
            >
              {bars(aging, (n) => `${n / 1000}k`)}
            </Chart>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Open balances</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.live
                    .filter((o) => o.total > o.paid)
                    .slice(0, 8)
                    .map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>{o.number}</TableCell>
                        <TableCell>{o.customer}</TableCell>
                        <TableCell>{o.dueDate}</TableCell>
                        <TableCell>{peso(o.total)}</TableCell>
                        <TableCell>{peso(o.paid)}</TableCell>
                        <TableCell>{peso(o.total - o.paid)}</TableCell>
                        <TableCell>
                          <Status s={o.payStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-4">
          <Alert>
            <AlertTitle>Mock data treats each order as one delivery</AlertTitle>
            <AlertDescription>
              The real model must count multi-order deliveries once and report
              stops separately. Failure rate = failed ÷ attempted; cancelled
              excluded.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              loading={loading}
              label="Total deliveries"
              value={String(
                rows.filter((o) => o.deliveryStatus !== "CANCELLED").length,
              )}
              hint="excl. cancelled"
              icon={Truck}
            />
            <Kpi
              loading={loading}
              label="Completed"
              value={String(m.completed)}
              hint=""
              icon={PackageCheck}
            />
            <Kpi
              loading={loading}
              label="Failed"
              value={String(m.failed)}
              hint=""
              icon={AlertTriangle}
            />
            <Kpi
              loading={loading}
              label="Avg duration"
              value={`${Math.round(m.avgDuration)} min`}
              hint="attempted deliveries"
              icon={Scale}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Chart loading={loading} title="Deliveries by type">
              {pie(byType)}
            </Chart>
            <Chart loading={loading} title="Deliveries by vehicle">
              {bars(byVehicle)}
            </Chart>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              loading={loading}
              label="Active customers"
              value={String(CUSTOMERS.length)}
              hint=""
              icon={ShoppingCart}
            />
            <Kpi
              loading={loading}
              label="With orders"
              value={String(customers.length)}
              hint="in period"
              icon={ShoppingCart}
            />
            <Kpi
              loading={loading}
              label="Repeat customers"
              value={String(customers.filter((c) => c.n > 1).length)}
              hint="2+ orders"
              icon={RefreshCw}
            />
            <Kpi
              loading={loading}
              label="Avg order value"
              value={peso(m.aov)}
              hint=""
              icon={Scale}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer performance</CardTitle>
              <CardDescription>
                Sales and payments collected are separate figures.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Payments</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Last order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers
                    .sort((a, b) => b.sales - a.sales)
                    .map((c) => (
                      <TableRow key={c.c}>
                        <TableCell>
                          <button
                            className="font-medium hover:underline"
                            onClick={() => setCust(c.c)}
                          >
                            {c.c}
                          </button>
                        </TableCell>
                        <TableCell>{c.n}</TableCell>
                        <TableCell>{peso(c.sales)}</TableCell>
                        <TableCell>{peso(c.paid)}</TableCell>
                        <TableCell>{peso(c.bal)}</TableCell>
                        <TableCell>{c.last}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={dlg}
        onOpenChange={(o) => (o ? setDlg(true) : closeDialog())}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {!preview ? (
            <>
              <DialogHeader>
                <DialogTitle>Generate report</DialogTitle>
                <DialogDescription>
                  Choose what to include. Uses the date range and filters
                  currently applied to this page.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Select value={rType} onValueChange={(v) => setRType(v as any)}>
                  <SelectTrigger aria-label="Report type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t} report
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={rFormat} onValueChange={(value) => { if (value !== null) setRFormat(value); }}>
                  <SelectTrigger aria-label="Export format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["PDF", "XLSX", "CSV"].map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={generate}>Generate preview</Button>
              </DialogFooter>
            </>
          ) : preview === "loading" ? (
            <>
              <DialogHeader>
                <DialogTitle>Preparing preview</DialogTitle>
              </DialogHeader>
              <Skeleton className="h-32 w-full" />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>HY Company — {rType} report</DialogTitle>
                <DialogDescription>Preview with sample data</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>
                  Period: {periodLabel} · Generated{" "}
                  {TODAY.toISOString().slice(0, 10)} · Format: {rFormat}
                </p>
                <p>
                  Filters:{" "}
                  {activeFilters.length
                    ? activeFilters.map(([k, v]) => `${k}=${v}`).join(", ")
                    : "none"}
                </p>
                <Separator />
                <div className="grid grid-cols-3 gap-2">
                  {summary[rType].map(([l, v]) => (
                    <div key={l}>
                      <div className="text-xs text-muted-foreground">{l}</div>
                      <div className="font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
                <Separator />
                <p>Rows included: {rowCount}</p>
                {exportMsg && (
                  <Alert>
                    <AlertDescription>{exportMsg}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Back
                </Button>
                <Button
                  onClick={() =>
                    setExportMsg(
                      `Export simulated. No ${rFormat} file was created — real export arrives with the backend phase.`,
                    )
                  }
                >
                  Export {rFormat}
                </Button>
                <Button variant="ghost" onClick={closeDialog}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={!!cust} onOpenChange={(o) => !o && setCust(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{cust}</SheetTitle>
            <SheetDescription>
              Orders in {periodLabel} matching the current filters.
            </SheetDescription>
          </SheetHeader>
          {/* TODO(Phase 5): show financial columns only to roles with finance permission */}
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.live
                .filter((o) => o.customer === cust)
                .map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{o.number}</TableCell>
                    <TableCell>{o.date}</TableCell>
                    <TableCell>{peso(o.total)}</TableCell>
                    <TableCell>{peso(o.total - o.paid)}</TableCell>
                    <TableCell>
                      <Status s={o.payStatus} />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </SheetContent>
      </Sheet>
    </div>
  );
}
