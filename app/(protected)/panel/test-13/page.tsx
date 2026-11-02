"use client";
// Analysis & Reports — mock data shaped like your schema. Place at app/(admin)/analysis-reports/page.tsx
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronDown,
  CircleDollarSign,
  FileText,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Scale,
  ShoppingCart,
  Truck,
  Wallet,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ARRANGEMENTS,
  CUSTOMER_OPTS,
  DEFAULT_FILTERS,
  DELIVERY_STATUSES,
  DELIVERY_TYPES,
  METHODS,
  NOW,
  ORDERS,
  ORDER_STATUSES,
  PAY_STATUSES,
  PRODUCT_OPTS,
  VEHICLE_OPTS,
  WAREHOUSE_OPTS,
  agingBuckets,
  deliveryMetrics,
  eo,
  filterEvents,
  filterInventory,
  filterOrders,
  filterPayments,
  filterStops,
  groupSum,
  isCustom,
  manilaDay,
  orderMetrics,
  sumBy,
  trend,
  type Filters,
  type Opt,
  type OrderView,
} from "./analytics";

const ymd = (d: Date) => d.toLocaleDateString("en-CA");
const peso = (n: number) => `₱${Math.round(n).toLocaleString("en-PH")}`;
const day = (t: number) => manilaDay(t);
const C = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const PRESETS: [string, string][] = [
  ["today", "Today"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
  ["mtd", "Month to date"],
  ["ytd", "Year to date"],
  ["custom", "Custom range"],
];
const SLOW_UNITS = 10;
type ArrKey = Exclude<keyof Filters, "preset" | "from" | "to" | "overdueOnly">;
const FILTERS: { key: ArrKey; label: string; options: Opt[] }[] = [
  { key: "customers", label: "Customer", options: CUSTOMER_OPTS },
  { key: "products", label: "Product", options: PRODUCT_OPTS },
  { key: "warehouses", label: "Warehouse", options: WAREHOUSE_OPTS },
  { key: "arrangements", label: "Arrangement", options: eo(ARRANGEMENTS) },
  { key: "payStatuses", label: "Payment status", options: eo(PAY_STATUSES) },
  { key: "orderStatuses", label: "Order status", options: eo(ORDER_STATUSES) },
  { key: "paymentMethods", label: "Payment method", options: eo(METHODS) },
  {
    key: "deliveryStatuses",
    label: "Delivery status",
    options: eo(DELIVERY_STATUSES),
  },
  { key: "deliveryTypes", label: "Delivery type", options: eo(DELIVERY_TYPES) },
  { key: "vehicles", label: "Vehicle", options: VEHICLE_OPTS },
];

function MultiSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: Opt[];
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" className="w-full justify-between sm:w-48">
            <span className="truncate">
              {label}
              {value.length ? ` (${value.length})` : ""}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-60 p-2" align="start">
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={value.includes(o.value)}
                onCheckedChange={(c) =>
                  onChange(
                    c
                      ? [...value, o.value]
                      : value.filter((x) => x !== o.value),
                  )
                }
              />
              {o.label}
            </label>
          ))}
        </div>
        {value.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full"
            onClick={() => onChange([])}
          >
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
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
const Status = ({ s }: { s: string }) => {
  const l = s.toLowerCase();
  return (
    <Badge
      variant={
        ["paid", "completed", "delivered", "approved"].includes(l)
          ? "default"
          : ["overdue", "failed", "cancelled", "rejected"].includes(l)
            ? "destructive"
            : "secondary"
      }
    >
      {s.replace(/_/g, " ")}
    </Badge>
  );
};
const Basis = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-muted-foreground">Date basis: {children}</p>
);
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
      data={data.map((d) => ({ ...d, name: d.name.replace(/_/g, " ") }))}
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
const k = (n: number) => `${Math.round(n / 1000)}k`;
const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);

function OrdersTable({
  rows,
  onCustomer,
}: {
  rows: OrderView[];
  onCustomer?: (id: number) => void;
}) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(0),
    [desc, setDesc] = useState(true);
  const list = rows
    .filter((o) =>
      `${o.number} ${o.customer}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => (desc ? b.total - a.total : a.total - b.total));
  const pages = Math.max(1, Math.ceil(list.length / 8));
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
              <TableHead>Items</TableHead>
              <TableHead>
                <button className="font-medium" onClick={() => setDesc(!desc)}>
                  Total {desc ? "↓" : "↑"}
                </button>
              </TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.slice(page * 8, page * 8 + 8).map((o) => (
              <TableRow key={o.id}>
                <TableCell>{o.number}</TableCell>
                <TableCell>{day(o.at)}</TableCell>
                <TableCell>{o.customer}</TableCell>
                <TableCell>{o.items.length}</TableCell>
                <TableCell>{peso(o.total)}</TableCell>
                <TableCell>{peso(o.balance)}</TableCell>
                <TableCell>
                  <Status s={o.payStatus} />
                </TableCell>
                <TableCell>
                  <Status s={o.status} />
                </TableCell>
              </TableRow>
            ))}
            {!list.length && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  No orders match these filters. Clear filters or widen the date
                  range.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>{list.length} orders</span>
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

const REPORTS = [
  "Sales",
  "Inventory",
  "Payment",
  "Delivery",
  "Customer",
] as const;

export default function AnalysisReportsPage() {
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const [ready, setReady] = useState(false);
  const [grain, setGrain] = useState<"day" | "week" | "month">("week");
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [threshold, setThreshold] = useState(25),
    [lowOnly, setLowOnly] = useState(false);
  const [cust, setCust] = useState<number | null>(null);
  const [dlg, setDlg] = useState(false),
    [rType, setRType] = useState<(typeof REPORTS)[number]>("Sales"),
    [rFormat, setRFormat] = useState("PDF");
  const [preview, setPreview] = useState<null | "loading" | "ready">(null),
    [exportMsg, setExportMsg] = useState<string | null>(null);

  // filters live in the URL (?f=...) so a filtered view can be shared
  useEffect(() => {
    try {
      const p = new URLSearchParams(location.search).get("f");
      if (p) setF({ ...DEFAULT_FILTERS, ...JSON.parse(p) });
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const diff = Object.fromEntries(
      Object.entries(f).filter(
        ([key, v]) =>
          JSON.stringify(v) !== JSON.stringify((DEFAULT_FILTERS as any)[key]),
      ),
    );
    const u = new URL(location.href);
    Object.keys(diff).length
      ? u.searchParams.set("f", JSON.stringify(diff))
      : u.searchParams.delete("f");
    history.replaceState(null, "", u);
  }, [f, ready]);

  const orders = filterOrders(f),
    m = orderMetrics(orders),
    pm = orderMetrics(filterOrders(f, 1));
  const pays = filterPayments(f),
    cash = sumBy(pays, (p) => p.amount),
    prevCash = sumBy(filterPayments(f, 1), (p) => p.amount);
  const stops = filterStops(f),
    dm = deliveryMetrics(stops),
    pdm = deliveryMetrics(filterStops(f, 1));
  const events = filterEvents(f);
  const stock = filterInventory(f);
  const periodLabel = isCustom(f)
    ? `${f.from} to ${f.to}`
    : PRESETS.find(([v]) => v === f.preset)![1];
  const active = FILTERS.filter((x) => f[x.key].length)
    .map((x) => `${x.label}: ${f[x.key].length}`)
    .concat(f.overdueOnly ? ["Overdue only"] : []);
  const set = (key: ArrKey) => (v: string[]) =>
    setF((p) => ({ ...p, [key]: v }));

  const lines = m.live
    .flatMap((o) => o.items)
    .filter(
      (i) => !f.products.length || f.products.includes(String(i.productId)),
    );
  const sold = new Map<number, number>();
  lines.forEach((i) =>
    sold.set(i.inventoryId, (sold.get(i.inventoryId) ?? 0) + i.qty),
  );
  const lastSold = new Map<number, number>();
  ORDERS.filter((o) => o.status !== "CANCELLED").forEach((o) =>
    o.items.forEach((i) =>
      lastSold.set(
        i.inventoryId,
        Math.max(lastSold.get(i.inventoryId) ?? 0, o.at),
      ),
    ),
  );
  const low = stock.filter((r) => r.available > 0 && r.available <= threshold),
    out = stock.filter((r) => r.available <= 0);
  const stockRows = lowOnly
    ? stock.filter((r) => r.available <= threshold)
    : stock;
  const slow = stock.filter(
    (r) => r.available > 0 && (sold.get(r.id) ?? 0) <= SLOW_UNITS,
  );
  const customers = [...new Set(m.live.map((o) => o.customerId))]
    .map((id) => {
      const r = m.live.filter((o) => o.customerId === id);
      return {
        id,
        name: r[0].customer,
        n: r.length,
        sales: sumBy(r, (o) => o.total),
        paid: sumBy(r, (o) => o.paid),
        bal: sumBy(r, (o) => o.balance),
        last: day(r[0].at),
      };
    })
    .sort((a, b) => b.sales - a.sales);
  const open = m.live
    .filter((o) => o.balance > 0)
    .sort(
      (a, b) =>
        Number(b.payStatus === "OVERDUE") - Number(a.payStatus === "OVERDUE") ||
        b.balance - a.balance,
    );
  const stockChart = [
    ...new Map(stock.map((r) => [r.variantId, r.sku])).entries(),
  ].map(([id, sku]) => ({
    name: sku,
    Available: sumBy(
      stock.filter((r) => r.variantId === id),
      (r) => r.available,
    ),
    Reserved: sumBy(
      stock.filter((r) => r.variantId === id),
      (r) => r.reserved,
    ),
  }));
  const stockLabel = (a: number) =>
    a <= 0 ? "OUT" : a <= threshold ? "LOW" : "OK";

  const refresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 700);
  };
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
      ["Orders", String(m.count)],
      ["Average order value", peso(m.aov)],
    ],
    Inventory: [
      ["Stock rows", String(stock.length)],
      ["Low stock", String(low.length)],
      ["Out of stock", String(out.length)],
    ],
    Payment: [
      ["Received", peso(cash)],
      ["Outstanding", peso(m.outstanding)],
      ["Overdue", peso(m.overdue)],
    ],
    Delivery: [
      ["Deliveries", String(dm.deliveries.length)],
      ["Failed stops", String(dm.failed)],
      ["Failure rate", `${dm.rate.toFixed(1)}%`],
    ],
    Customer: [
      ["Customers", String(customers.length)],
      ["Total sales", peso(m.revenue)],
      ["Outstanding", peso(m.outstanding)],
    ],
  };
  const rowCount = {
    Sales: orders.length,
    Inventory: stock.length,
    Payment: pays.length,
    Delivery: stops.length,
    Customer: customers.length,
  }[rType];
  const custOrders = m.live.filter((o) => o.customerId === cust);

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
          <Select
            value={f.preset}
            onValueChange={(v) => { if (v !== null) setF((p) => ({ ...p, preset: v })); }}
          >
            <SelectTrigger className="w-44" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {f.preset === "custom" && (
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {f.from && f.to
                      ? `${f.from} to ${f.to}`
                      : f.from
                        ? "Pick an end date"
                        : "Pick dates"}
                  </Button>
                }
              />
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
          <Button variant="outline" onClick={() => setF(DEFAULT_FILTERS)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
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
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? "Hide" : "Show"} filters
            {active.length ? ` (${active.length})` : ""}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={f.overdueOnly}
              onCheckedChange={(v) => setF((p) => ({ ...p, overdueOnly: v }))}
            />
            Overdue only
          </label>
          {active.map((a) => (
            <Badge key={a} variant="secondary">
              {a}
            </Badge>
          ))}
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap">
            {FILTERS.map((x) => (
              <MultiSelect
                key={x.key}
                label={x.label}
                value={f[x.key]}
                onChange={set(x.key)}
                options={x.options}
              />
            ))}
          </div>
        )}
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Sample data</AlertTitle>
        <AlertDescription>
          Figures come from mock rows shaped like your tables. Cancelled orders
          are excluded from sales. Day boundaries use Asia/Manila.
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
          <Basis>
            sales by order date, payments by date received, deliveries by
            scheduled date. Period: {periodLabel}.
          </Basis>
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
              label="Orders"
              value={String(m.count)}
              delta={delta(m.count, pm.count)}
              hint="non-cancelled"
              icon={ShoppingCart}
            />
            <Kpi
              loading={loading}
              label="Payments received"
              value={peso(cash)}
              delta={delta(cash, prevCash)}
              hint="cash basis"
              icon={Wallet}
            />
            <Kpi
              loading={loading}
              label="Outstanding balance"
              value={peso(m.outstanding)}
              hint="on filtered orders"
              icon={Scale}
            />
            <Kpi
              loading={loading}
              label="Stops delivered"
              value={String(dm.delivered)}
              delta={delta(dm.delivered, pdm.delivered)}
              hint="in period"
              icon={PackageCheck}
            />
            <Kpi
              loading={loading}
              label="Delivery failure rate"
              value={`${dm.rate.toFixed(1)}%`}
              hint="failed ÷ attempted stops"
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
              <LineChart
                data={trend(
                  m.live.map((o) => ({ at: o.at, v: o.total })),
                  grain,
                )}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={k} />
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
              title="Orders by status"
              description="All orders in period, including cancelled"
            >
              {pie(
                groupSum(
                  orders,
                  (o) => o.status,
                  () => 1,
                ),
              )}
            </Chart>
            <Chart
              loading={loading}
              title="Payment status"
              description="Order counts, derived from payments vs order total"
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
                <CardTitle className="text-base">Recent orders</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.slice(0, 5).map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>{day(o.at)}</TableCell>
                        <TableCell>{o.number}</TableCell>
                        <TableCell>{o.customer}</TableCell>
                        <TableCell>{peso(o.total)}</TableCell>
                        <TableCell>
                          <Status s={o.status} />
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
          <Basis>
            order created date. Order totals are the sum of quantity × current
            variant price.
          </Basis>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              loading={loading}
              label="Total sales"
              value={peso(m.revenue)}
              delta={delta(m.revenue, pm.revenue)}
              hint="vs previous"
              icon={CircleDollarSign}
            />
            <Kpi
              loading={loading}
              label="Orders"
              value={String(m.count)}
              hint={`${m.cancelled} cancelled excluded`}
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
              label="Units sold"
              value={String(sumBy(lines, (i) => i.qty))}
              hint="all order items"
              icon={PackageCheck}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Chart
              loading={loading}
              title="Sales by product"
              description="Item totals"
            >
              {bars(
                groupSum(
                  lines,
                  (i) => i.product,
                  (i) => i.line,
                ).sort((a, b) => b.value - a.value),
                k,
              )}
            </Chart>
            <Chart loading={loading} title="Sales by warehouse">
              {bars(
                groupSum(
                  m.live,
                  (o) => o.warehouse,
                  (o) => o.total,
                ),
                k,
              )}
            </Chart>
            <Chart loading={loading} title="Sales by customer">
              {bars(
                groupSum(
                  m.live,
                  (o) => o.customer.split(" ")[0],
                  (o) => o.total,
                ).sort((a, b) => b.value - a.value),
                k,
              )}
            </Chart>
          </div>
          <OrdersTable rows={orders} />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Basis>
            stock is a current snapshot; units sold use the selected period.
            Quantities are per warehouse (filter by warehouse above).
          </Basis>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi
              loading={loading}
              label="Stock rows"
              value={String(stock.length)}
              hint="warehouse × variant"
              icon={PackageCheck}
            />
            <Kpi
              loading={loading}
              label="Low stock"
              value={String(low.length)}
              hint={`available ≤ ${threshold}`}
              icon={AlertTriangle}
            />
            <Kpi
              loading={loading}
              label="Out of stock"
              value={String(out.length)}
              hint="available = 0"
              icon={AlertTriangle}
            />
            <Kpi
              loading={loading}
              label="Reserved units"
              value={String(sumBy(stock, (r) => r.reserved))}
              hint="open orders"
              icon={Scale}
            />
            <Kpi
              loading={loading}
              label="Stock value"
              value={peso(sumBy(stock, (r) => r.quantity * r.price))}
              hint="at current price"
              icon={CircleDollarSign}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              Low-stock threshold
              <Input
                type="number"
                min={0}
                className="w-20"
                value={threshold}
                onChange={(e) =>
                  setThreshold(Math.max(0, Number(e.target.value)))
                }
              />
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={lowOnly} onCheckedChange={setLowOnly} />
              Low / out of stock only
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Chart
              loading={loading}
              title="Top sellers by units"
              description={`Units sold, ${periodLabel}`}
            >
              {bars(
                groupSum(
                  lines,
                  (i) => `${i.sku}`,
                  (i) => i.qty,
                ).sort((a, b) => b.value - a.value),
              )}
            </Chart>
            <Chart
              loading={loading}
              title="Stock by variant"
              description="Available vs reserved (selected warehouses)"
            >
              <BarChart data={stockChart}>
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
              <CardTitle className="text-base">Stock levels</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>On hand</TableHead>
                    <TableHead>Reserved</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.product}</TableCell>
                      <TableCell>{r.variant}</TableCell>
                      <TableCell>{r.sku}</TableCell>
                      <TableCell>{r.warehouse}</TableCell>
                      <TableCell>{r.quantity}</TableCell>
                      <TableCell>{r.reserved}</TableCell>
                      <TableCell>
                        {r.available} {r.unit}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            stockLabel(r.available) === "OK"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {stockLabel(r.available)}
                        </Badge>
                      </TableCell>
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
                In stock, {SLOW_UNITS} or fewer units sold in {periodLabel}.
                Last sold comes from order items (no stock-movement table).
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Units sold</TableHead>
                    <TableHead>Last sold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slow.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.product} {r.variant}
                      </TableCell>
                      <TableCell>{r.sku}</TableCell>
                      <TableCell>{r.warehouse}</TableCell>
                      <TableCell>{r.available}</TableCell>
                      <TableCell>{sold.get(r.id) ?? 0}</TableCell>
                      <TableCell>
                        {lastSold.get(r.id)
                          ? day(lastSold.get(r.id)!)
                          : "never"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!slow.length && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
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
          <Basis>
            received = payments by received date; balances = filtered orders (by
            order date). Due dates follow the terms in analytics.ts.
          </Basis>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              loading={loading}
              label="Payments received"
              value={peso(cash)}
              delta={delta(cash, prevCash)}
              hint="vs previous"
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
              hint="past due with balance"
              icon={AlertTriangle}
            />
            <Kpi
              loading={loading}
              label="Partially paid orders"
              value={String(
                m.live.filter((o) => o.paid > 0 && o.balance > 0).length,
              )}
              hint=""
              icon={CircleDollarSign}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Chart loading={loading} title="Received by method">
              {pie(
                groupSum(
                  pays,
                  (p) => p.method,
                  (p) => p.amount,
                ),
              )}
            </Chart>
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
              title="Receivables aging"
              description="Balance by days past due"
            >
              {bars(agingBuckets(orders), k)}
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
                    <TableHead>Terms</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {open.slice(0, 8).map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{o.number}</TableCell>
                      <TableCell>{o.customer}</TableCell>
                      <TableCell>{o.arrangement.replace(/_/g, " ")}</TableCell>
                      <TableCell>{o.dueAt ? day(o.dueAt) : "—"}</TableCell>
                      <TableCell>{peso(o.total)}</TableCell>
                      <TableCell>{peso(o.paid)}</TableCell>
                      <TableCell>{peso(o.balance)}</TableCell>
                      <TableCell>
                        <Status s={o.payStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!open.length && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-6 text-center text-muted-foreground"
                      >
                        No open balances for these filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-4">
          <Basis>
            delivery scheduled date. A delivery is counted once however many
            stops it has; failure rate = failed ÷ (delivered + failed) stops;
            cancelled deliveries excluded.
          </Basis>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi
              loading={loading}
              label="Deliveries"
              value={String(dm.deliveries.length)}
              delta={delta(dm.deliveries.length, pdm.deliveries.length)}
              hint="vs previous"
              icon={Truck}
            />
            <Kpi
              loading={loading}
              label="Stops delivered"
              value={String(dm.delivered)}
              hint=""
              icon={PackageCheck}
            />
            <Kpi
              loading={loading}
              label="Failed stops"
              value={String(dm.failed)}
              hint=""
              icon={AlertTriangle}
            />
            <Kpi
              loading={loading}
              label="Failure rate"
              value={`${dm.rate.toFixed(1)}%`}
              hint=""
              icon={Scale}
            />
            <Kpi
              loading={loading}
              label="Avg completion"
              value={`${Math.round(dm.avgMin)} min`}
              hint="departure to last stop"
              icon={RefreshCw}
            />
            <Kpi
              loading={loading}
              label="Approved cost"
              value={peso(dm.cost)}
              hint="allowance + fuel + toll"
              icon={Wallet}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Chart loading={loading} title="Deliveries by type">
              {pie(
                groupSum(
                  dm.deliveries,
                  (d) => d.type,
                  () => 1,
                ),
              )}
            </Chart>
            <Chart loading={loading} title="Deliveries by vehicle">
              {bars(
                groupSum(
                  dm.deliveries,
                  (d) => d.vehicle,
                  () => 1,
                ),
              )}
            </Chart>
            <Chart loading={loading} title="Deliveries by status">
              {pie(
                groupSum(
                  dm.deliveries,
                  (d) => d.status,
                  () => 1,
                ),
              )}
            </Chart>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery issues</CardTitle>
              <CardDescription>
                Failed, delayed, rescheduled and cancelled events.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.delivery.date}</TableCell>
                      <TableCell>#{e.delivery.id}</TableCell>
                      <TableCell>{e.delivery.vehicle}</TableCell>
                      <TableCell>{e.delivery.driver}</TableCell>
                      <TableCell>
                        <Status s={e.type} />
                      </TableCell>
                      <TableCell>{e.reason ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!events.length && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-6 text-center text-muted-foreground"
                      >
                        No delivery issues in this period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Basis>
            order created date. Sales and payments are separate figures.
          </Basis>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              loading={loading}
              label="Customers with orders"
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
            <Kpi
              loading={loading}
              label="Outstanding"
              value={peso(m.outstanding)}
              hint="all customers shown"
              icon={Wallet}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer performance</CardTitle>
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
                  {customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <button
                          className="font-medium hover:underline"
                          onClick={() => setCust(c.id)}
                        >
                          {c.name}
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
                  Uses the date range and filters currently applied to this
                  page.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Select value={rType} onValueChange={(v) => setRType(v as any)}>
                  <SelectTrigger aria-label="Report type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORTS.map((t) => (
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
                  Period: {periodLabel} · Generated {manilaDay(NOW)} · Format:{" "}
                  {rFormat}
                </p>
                <p>Filters: {active.length ? active.join(", ") : "none"}</p>
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

      <Sheet open={cust !== null} onOpenChange={(o) => !o && setCust(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{custOrders[0]?.customer}</SheetTitle>
            <SheetDescription>
              Orders in {periodLabel} matching the current filters.
            </SheetDescription>
          </SheetHeader>
          {/* TODO(Phase 5): show financial columns only to roles allowed to see them */}
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
              {custOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{o.number}</TableCell>
                  <TableCell>{day(o.at)}</TableCell>
                  <TableCell>{peso(o.total)}</TableCell>
                  <TableCell>{peso(o.balance)}</TableCell>
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
