// Derives report numbers from the raw tables. These rules are what Phase 5 moves into SQL/Drizzle queries.
import * as db from "./mock-data";
import type {
  DeliveryStatus,
  DeliveryType,
  ExpenseStatus,
  OrderStatus,
  PaymentArrangement,
  PaymentMethod,
  PaymentStatus,
  StopStatus,
} from "./mock-data";
export { NOW, ARRANGEMENTS, METHODS } from "./mock-data";
import { NOW } from "./mock-data";

const DAY = 864e5;
export const manilaDay = (d: Date | number) =>
  new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const dayStart = (s: string) => new Date(`${s}T00:00:00+08:00`).getTime();
const num = (s: string) => Number(s);
export const sumBy = <T>(a: T[], f: (x: T) => number) =>
  a.reduce((s, x) => s + f(x), 0);
export function groupSum<T>(
  rows: T[],
  key: (r: T) => string,
  val: (r: T) => number,
) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + val(r)));
  return [...m].map(([name, value]) => ({ name, value }));
}
const byId = <T extends { id: number }>(a: T[]) =>
  new Map(a.map((x) => [x.id, x]));
const groupBy = <T>(a: T[], k: (x: T) => number) => {
  const m = new Map<number, T[]>();
  a.forEach((x) => m.set(k(x), [...(m.get(k(x)) ?? []), x]));
  return m;
};

// ---- BUSINESS RULES TO CONFIRM (the schema stores neither a due date nor an order total) ----
export const DUE_TERMS: Record<PaymentArrangement, number | "delivery"> = {
  FULLY_PAID: 0,
  PARTIALLY_PAID: 30,
  PAY_ON_DELIVERY: "delivery",
  NET_30: 30,
};
const RECEIVED: PaymentStatus[] = ["PAID", "PARTIALLY_PAID"]; // payment rows that count as money received

export interface DeliveryView {
  id: number;
  date: string;
  departureAt: number;
  type: DeliveryType;
  status: DeliveryStatus;
  vehicle: string;
  driver: string;
  warehouseId: number;
  cost: number;
  costStatus: ExpenseStatus | null;
}
export interface ItemView {
  inventoryId: number;
  productId: number;
  product: string;
  variantId: number;
  variant: string;
  sku: string;
  qty: number;
  line: number;
}
export interface OrderView {
  id: number;
  number: string;
  at: number;
  customerId: number;
  customer: string;
  warehouseId: number;
  warehouse: string;
  status: OrderStatus;
  arrangement: PaymentArrangement;
  items: ItemView[];
  total: number;
  paid: number;
  balance: number;
  dueAt: number | null;
  payStatus: PaymentStatus;
  delivery: DeliveryView | null;
}
export interface StopView {
  id: number;
  status: StopStatus;
  deliveredAt: number | null;
  delivery: DeliveryView;
  order: OrderView;
}
export interface PaymentView {
  id: number;
  number: string;
  method: PaymentMethod;
  amount: number;
  at: number;
  order: OrderView;
}
export interface InventoryView {
  id: number;
  warehouseId: number;
  warehouse: string;
  productId: number;
  product: string;
  variantId: number;
  variant: string;
  sku: string;
  unit: string;
  price: number;
  quantity: number;
  reserved: number;
  available: number;
}
export interface EventView {
  id: number;
  type: string;
  reason: string | null;
  at: number;
  delivery: DeliveryView;
}

const wh = byId(db.warehouses),
  cu = byId(db.customers),
  us = byId(db.users),
  va = byId(db.product_variants),
  pr = byId(db.products),
  inv = byId(db.inventory),
  ve = byId(db.vehicles),
  dr = byId(db.drivers);
const expense = new Map(db.deliveries_expenses.map((e) => [e.delivery_id, e]));

export const DELIVERIES: DeliveryView[] = db.deliveries.map((d) => {
  const v = ve.get(d.vehicle_id)!,
    e = expense.get(d.id);
  return {
    id: d.id,
    date: d.scheduled_date,
    departureAt: new Date(
      `${d.scheduled_date}T${d.departure_time}+08:00`,
    ).getTime(),
    type: d.delivery_type,
    status: d.status,
    vehicle: v.plate_number,
    driver: us.get(dr.get(d.driver_id)!.user_id)!.name,
    warehouseId: v.warehouse_id,
    cost: e ? num(e.delivery_allowance) + num(e.fuel) + num(e.toll) : 0,
    costStatus: e?.status ?? null,
  };
});
const dById = byId(DELIVERIES);
const itemsByOrder = groupBy(db.order_items, (i) => i.order_id);
const stopsByOrder = groupBy(db.deliveries_stops, (s) => s.order_id);
const paidByOrder = new Map<number, number>();
db.payments
  .filter((p) => RECEIVED.includes(p.payment_status))
  .forEach((p) =>
    paidByOrder.set(
      p.order_id,
      (paidByOrder.get(p.order_id) ?? 0) + num(p.amount),
    ),
  );

export const ORDERS: OrderView[] = db.orders
  .map((o) => {
    const items = (itemsByOrder.get(o.id) ?? []).map((i): ItemView => {
      const r = inv.get(i.inventory_id)!,
        v = va.get(r.product_variant_id)!;
      return {
        inventoryId: r.id,
        productId: r.product_id,
        product: pr.get(r.product_id)!.name,
        variantId: v.id,
        variant: v.name,
        sku: v.sku,
        qty: i.quantity,
        line: i.quantity * num(v.price),
      };
    });
    const stops = stopsByOrder.get(o.id) ?? [];
    const delivery = stops.length
      ? dById.get(stops[stops.length - 1].delivery_id)!
      : null;
    const arrangement = o.payment_arrangement ?? "NET_30";
    const terms = DUE_TERMS[arrangement];
    const at = o.created_at.getTime();
    const dueAt =
      terms === "delivery"
        ? delivery
          ? dayStart(delivery.date) + DAY
          : null
        : at + terms * DAY;
    const total = sumBy(items, (i) => i.line),
      paid = paidByOrder.get(o.id) ?? 0,
      balance = Math.max(total - paid, 0);
    const overdue =
      o.status !== "CANCELLED" &&
      balance > 0 &&
      dueAt !== null &&
      dueAt < NOW.getTime();
    const c = cu.get(o.customer_id)!;
    return {
      id: o.id,
      number: o.order_number,
      at,
      customerId: c.id,
      customer:
        c.company_name !== "none" ? c.company_name : us.get(c.user_id)!.name,
      warehouseId: o.warehouse_id,
      warehouse: wh.get(o.warehouse_id)!.name,
      status: o.status,
      arrangement,
      items,
      total,
      paid,
      balance,
      dueAt,
      delivery,
      payStatus: (balance === 0 && total > 0
        ? "PAID"
        : overdue
          ? "OVERDUE"
          : paid > 0
            ? "PARTIALLY_PAID"
            : "UNPAID") as PaymentStatus,
    };
  })
  .sort((a, b) => b.at - a.at);
const oById = byId(ORDERS);

export const STOPS: StopView[] = db.deliveries_stops.map((s) => ({
  id: s.id,
  status: s.status,
  deliveredAt: s.delivered_at?.getTime() ?? null,
  delivery: dById.get(s.delivery_id)!,
  order: oById.get(s.order_id)!,
}));
export const PAYMENTS: PaymentView[] = db.payments
  .filter((p) => RECEIVED.includes(p.payment_status))
  .map((p) => ({
    id: p.id,
    number: p.payment_number,
    method: p.payment_method,
    amount: num(p.amount),
    at: p.received_at.getTime(),
    order: oById.get(p.order_id)!,
  }));
export const EVENTS: EventView[] = db.deliveries_event.map((e) => ({
  id: e.id,
  type: e.event_type,
  reason: e.reason,
  at: e.created_at.getTime(),
  delivery: dById.get(e.delivery_id)!,
}));
export const INVENTORY: InventoryView[] = db.inventory.map((r) => {
  const v = va.get(r.product_variant_id)!;
  return {
    id: r.id,
    warehouseId: r.warehouse_id,
    warehouse: wh.get(r.warehouse_id)!.name,
    productId: r.product_id,
    product: pr.get(r.product_id)!.name,
    variantId: v.id,
    variant: v.name,
    sku: v.sku,
    unit: v.unit,
    price: num(v.price),
    quantity: r.quantity,
    reserved: r.reserved,
    available: r.quantity - r.reserved,
  };
});

// ---- Filters ----
export interface Filters {
  preset: string;
  from: string;
  to: string;
  customers: string[];
  products: string[];
  warehouses: string[];
  arrangements: string[];
  payStatuses: string[];
  orderStatuses: string[];
  deliveryStatuses: string[];
  deliveryTypes: string[];
  vehicles: string[];
  paymentMethods: string[];
  overdueOnly: boolean;
}
export const DEFAULT_FILTERS: Filters = {
  preset: "90d",
  from: "",
  to: "",
  customers: [],
  products: [],
  warehouses: [],
  arrangements: [],
  payStatuses: [],
  orderStatuses: [],
  deliveryStatuses: [],
  deliveryTypes: [],
  vehicles: [],
  paymentMethods: [],
  overdueOnly: false,
};
const PRESET_DAYS: Record<string, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};
export const isCustom = (f: Filters) =>
  f.preset === "custom" && !!f.from && !!f.to;

/** [start, end) in epoch ms on Manila day boundaries. back=1 gives the equal-length period before. */
export function rangeOf(f: Filters, back = 0) {
  const today = manilaDay(NOW);
  let start: number, end: number;
  if (isCustom(f)) {
    start = dayStart(f.from);
    end = dayStart(f.to) + DAY;
  } else {
    end = dayStart(today) + DAY;
    start =
      f.preset === "mtd"
        ? dayStart(today.slice(0, 8) + "01")
        : f.preset === "ytd"
          ? dayStart(today.slice(0, 5) + "01-01")
          : end - (PRESET_DAYS[f.preset] ?? 30) * DAY;
  }
  const len = end - start;
  return { start: start - back * len, end: end - back * len };
}
const inR = (t: number, r: { start: number; end: number }) =>
  t >= r.start && t < r.end;
const has = (a: string[], v: string) => !a.length || a.includes(v);
const deliveryOk = (d: DeliveryView | null, f: Filters) =>
  !(f.deliveryStatuses.length || f.deliveryTypes.length || f.vehicles.length) ||
  (!!d &&
    has(f.deliveryStatuses, d.status) &&
    has(f.deliveryTypes, d.type) &&
    has(f.vehicles, d.vehicle));
/** Order-level filters; `withDelivery` also applies status/type/vehicle through the order's latest delivery. */
export const orderOk = (o: OrderView, f: Filters, withDelivery = true) =>
  has(f.customers, String(o.customerId)) &&
  has(f.warehouses, String(o.warehouseId)) &&
  has(f.arrangements, o.arrangement) &&
  has(f.payStatuses, o.payStatus) &&
  has(f.orderStatuses, o.status) &&
  (!f.products.length ||
    o.items.some((i) => f.products.includes(String(i.productId)))) &&
  (!f.overdueOnly || o.payStatus === "OVERDUE") &&
  (!withDelivery || deliveryOk(o.delivery, f));

export const filterOrders = (f: Filters, back = 0) => {
  const r = rangeOf(f, back);
  return ORDERS.filter((o) => inR(o.at, r) && orderOk(o, f));
};
/** Cash basis: payments by received_at. */
export const filterPayments = (f: Filters, back = 0) => {
  const r = rangeOf(f, back);
  return PAYMENTS.filter(
    (p) =>
      inR(p.at, r) && has(f.paymentMethods, p.method) && orderOk(p.order, f),
  );
};
/** Deliveries basis: scheduled_date. */
export const filterStops = (f: Filters, back = 0) => {
  const r = rangeOf(f, back);
  return STOPS.filter(
    (s) =>
      inR(dayStart(s.delivery.date), r) &&
      deliveryOk(s.delivery, f) &&
      orderOk(s.order, f, false),
  );
};
export const filterEvents = (f: Filters, back = 0) => {
  const r = rangeOf(f, back);
  return EVENTS.filter(
    (e) =>
      inR(dayStart(e.delivery.date), r) &&
      deliveryOk(e.delivery, f) &&
      has(f.warehouses, String(e.delivery.warehouseId)),
  );
};
export const filterInventory = (f: Filters) =>
  INVENTORY.filter(
    (r) =>
      has(f.warehouses, String(r.warehouseId)) &&
      has(f.products, String(r.productId)),
  );

// ---- Metrics ----
export function orderMetrics(orders: OrderView[]) {
  const live = orders.filter((o) => o.status !== "CANCELLED"); // cancelled orders never count as sales
  const revenue = sumBy(live, (o) => o.total);
  return {
    live,
    count: live.length,
    cancelled: orders.length - live.length,
    revenue,
    paid: sumBy(live, (o) => o.paid),
    outstanding: sumBy(live, (o) => o.balance),
    overdue: sumBy(
      live.filter((o) => o.payStatus === "OVERDUE"),
      (o) => o.balance,
    ),
    aov: live.length ? revenue / live.length : 0,
  };
}
export function deliveryMetrics(stops: StopView[]) {
  const valid = stops.filter((s) => s.delivery.status !== "cancelled");
  const deliveries = [
    ...new Map(valid.map((s) => [s.delivery.id, s.delivery])).values(),
  ];
  const delivered = valid.filter((s) => s.status === "delivered").length,
    failed = valid.filter((s) => s.status === "failed").length;
  const mins = deliveries
    .filter((d) => d.status === "completed")
    .map((d) => {
      const t = valid
        .filter((s) => s.delivery.id === d.id && s.deliveredAt)
        .map((s) => s.deliveredAt!);
      return t.length ? (Math.max(...t) - d.departureAt) / 6e4 : null;
    })
    .filter((x): x is number => x !== null);
  return {
    deliveries,
    delivered,
    failed,
    rate: delivered + failed ? (failed / (delivered + failed)) * 100 : 0,
    avgMin: mins.length ? sumBy(mins, (x) => x) / mins.length : 0,
    cost: sumBy(
      deliveries.filter((d) => d.costStatus === "approved"),
      (d) => d.cost,
    ),
  };
}
export function agingBuckets(orders: OrderView[]) {
  const b: Record<string, number> = {
    "Not yet due": 0,
    "1–30 days": 0,
    "31–60 days": 0,
    "61–90 days": 0,
    "90+ days": 0,
    "No due date": 0,
  };
  orders
    .filter((o) => o.status !== "CANCELLED" && o.balance > 0)
    .forEach((o) => {
      const d =
        o.dueAt === null ? null : Math.floor((NOW.getTime() - o.dueAt) / DAY);
      b[
        d === null
          ? "No due date"
          : d <= 0
            ? "Not yet due"
            : d <= 30
              ? "1–30 days"
              : d <= 60
                ? "31–60 days"
                : d <= 90
                  ? "61–90 days"
                  : "90+ days"
      ] += o.balance;
    });
  return Object.entries(b).map(([name, value]) => ({ name, value }));
}
export function trend(
  rows: { at: number; v: number }[],
  grain: "day" | "week" | "month",
) {
  const key = (t: number) => {
    const d = manilaDay(t);
    if (grain === "day") return d;
    if (grain === "month") return d.slice(0, 7);
    const x = new Date(d + "T00:00:00Z");
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x.toISOString().slice(0, 10);
  };
  return groupSum(
    rows,
    (r) => key(r.at),
    (r) => r.v,
  ).sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Option lists for filters ----
export type Opt = { value: string; label: string };
const uniq = (a: Opt[]) => [...new Map(a.map((o) => [o.value, o])).values()];
export const CUSTOMER_OPTS = uniq(
  ORDERS.map((o) => ({ value: String(o.customerId), label: o.customer })),
);
export const PRODUCT_OPTS = uniq(
  INVENTORY.map((r) => ({ value: String(r.productId), label: r.product })),
);
export const WAREHOUSE_OPTS = uniq(
  INVENTORY.map((r) => ({ value: String(r.warehouseId), label: r.warehouse })),
);
export const VEHICLE_OPTS = uniq(
  DELIVERIES.map((d) => ({ value: d.vehicle, label: d.vehicle })),
);
export const eo = (a: readonly string[]): Opt[] =>
  a.map((v) => ({ value: v, label: v.replace(/_/g, " ") }));
export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "SCHEDULING",
  "SCHEDULED",
  "IN_TRANSIT",
  "COMPLETED",
  "CANCELLED",
];
export const PAY_STATUSES: PaymentStatus[] = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
];
export const DELIVERY_STATUSES: DeliveryStatus[] = [
  "scheduled",
  "in_transit",
  "completed",
  "returning",
  "cancelled",
];
export const DELIVERY_TYPES: DeliveryType[] = [
  "INTERNAL",
  "LALAMOVE",
  "PICKUP",
];
