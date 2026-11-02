// MOCK DATA shaped like your Drizzle tables (snake_case columns, numeric as string, timestamps as Date).
// Columns the reports never read (password_hash, shipping_*, image, ...) are omitted.
// Phase 5: replace these arrays with queries and swap the types for each table's `$inferSelect`.
export type PaymentArrangement =
  | "FULLY_PAID"
  | "PARTIALLY_PAID"
  | "PAY_ON_DELIVERY"
  | "NET_30";
export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SCHEDULING"
  | "SCHEDULED"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "CANCELLED";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD";
export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
export type DeliveryType = "LALAMOVE" | "PICKUP" | "INTERNAL";
export type DeliveryStatus =
  | "scheduled"
  | "in_transit"
  | "completed"
  | "returning"
  | "cancelled";
export type StopStatus = "pending" | "delivered" | "failed";
export type EventType = "CANCELLED" | "RESCHEDULED" | "DELAYED" | "FAILED";
export type ExpenseStatus = "pending" | "approved" | "rejected";

export type Warehouse = { id: number; name: string; city: string };
export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "staff" | "customer" | "driver";
};
export type Customer = {
  id: number;
  user_id: number;
  company_name: string;
  phone_number: string;
};
export type Driver = { id: number; user_id: number; warehouse_id: number };
export type Vehicle = {
  id: number;
  warehouse_id: number;
  plate_number: string;
  type: "truck" | "van" | "other";
};
export type Product = { id: number; name: string };
export type ProductVariant = {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  price: string;
  unit: string;
};
export type Inventory = {
  id: number;
  warehouse_id: number;
  product_id: number;
  product_variant_id: number;
  quantity: number;
  reserved: number;
};
export type Order = {
  id: number;
  order_number: string;
  warehouse_id: number;
  customer_id: number;
  payment_arrangement: PaymentArrangement | null;
  status: OrderStatus;
  created_at: Date;
};
export type OrderItem = {
  id: number;
  order_id: number;
  inventory_id: number;
  quantity: number;
  created_at: Date;
};
export type Payment = {
  id: number;
  payment_number: string;
  order_id: number;
  customer_id: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount: string;
  received_at: Date;
};
export type Delivery = {
  id: number;
  driver_id: number;
  vehicle_id: number;
  scheduled_date: string;
  departure_time: string;
  delivery_type: DeliveryType;
  status: DeliveryStatus;
};
export type DeliveryStop = {
  id: number;
  delivery_id: number;
  order_id: number;
  leg_index: number;
  status: StopStatus;
  delivered_at: Date | null;
};
export type DeliveryEvent = {
  id: number;
  delivery_id: number;
  event_type: EventType;
  reason: string | null;
  created_at: Date;
};
export type DeliveryExpense = {
  id: number;
  delivery_id: number;
  delivery_allowance: string;
  fuel: string;
  toll: string;
  status: ExpenseStatus;
};

export const ARRANGEMENTS: PaymentArrangement[] = [
  "FULLY_PAID",
  "PARTIALLY_PAID",
  "PAY_ON_DELIVERY",
  "NET_30",
];
export const METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD"];
export const NOW = new Date("2026-10-24T09:00:00+08:00"); // Phase 5: new Date()

const DAY = 864e5,
  MIN = 6e4;
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
const money = (n: number) => n.toFixed(2);
const manilaDay = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const cap = (t: number) => new Date(Math.min(t, NOW.getTime()));

export const warehouses: Warehouse[] = [
  { id: 1, name: "Meycauayan", city: "Meycauayan" },
  { id: 2, name: "Valenzuela", city: "Valenzuela" },
];
const COMPANIES = [
  "Santos Hardware",
  "Reyes Trading",
  "Dela Cruz Builders",
  "Lim Construction",
  "Garcia Supply",
  "Bautista Depot",
];
export const users: User[] = [
  ...COMPANIES.map(
    (c, i): User => ({
      id: i + 1,
      name: `${c.split(" ")[0]} (contact)`,
      email: `c${i + 1}@example.com`,
      role: "customer",
    }),
  ),
  ...["Ramon", "Jun", "Ben"].map(
    (n, i): User => ({
      id: 10 + i,
      name: n,
      email: `d${i + 1}@example.com`,
      role: "driver",
    }),
  ),
];
export const customers: Customer[] = COMPANIES.map((c, i) => ({
  id: i + 1,
  user_id: i + 1,
  company_name: c,
  phone_number: `0917000000${i}`,
}));
export const drivers: Driver[] = [
  { id: 1, user_id: 10, warehouse_id: 1 },
  { id: 2, user_id: 11, warehouse_id: 1 },
  { id: 3, user_id: 12, warehouse_id: 2 },
];
export const vehicles: Vehicle[] = [
  { id: 1, warehouse_id: 1, plate_number: "NBA 1234", type: "truck" },
  { id: 2, warehouse_id: 1, plate_number: "NCD 5678", type: "truck" },
  { id: 3, warehouse_id: 2, plate_number: "ABC 9012", type: "van" },
];
export const products: Product[] = [
  "Portland Cement",
  "Rebar",
  "Concrete Nails",
  "Marine Plywood",
  "Gloss Paint",
  "GI Sheet",
].map((name, i) => ({ id: i + 1, name }));
const V: [number, string, string, number, string][] = [
  [1, "40kg bag", "CEM-040", 280, "bag"],
  [2, "10mm x 6m", "REB-010", 310, "pc"],
  [2, "12mm x 6m", "REB-012", 440, "pc"],
  [3, "3in", "NAI-003", 95, "kg"],
  [4, "1/2in", "PLY-012", 1150, "sheet"],
  [4, "3/4in", "PLY-034", 1450, "sheet"],
  [5, "White 4L", "PNT-W04", 890, "can"],
  [6, "0.4mm", "GIS-004", 560, "sheet"],
];
export const product_variants: ProductVariant[] = V.map(
  ([product_id, name, sku, price, unit], i) => ({
    id: i + 1,
    product_id,
    name,
    sku,
    price: money(price),
    unit,
  }),
);
const BASE = [420, 90, 60, 0, 45, 35, 210, 150];
export const inventory: Inventory[] = warehouses.flatMap((w) =>
  product_variants.map((v, i) => ({
    id: (w.id - 1) * 8 + i + 1,
    warehouse_id: w.id,
    product_id: v.product_id,
    product_variant_id: v.id,
    quantity: Math.round(BASE[i] * (w.id === 1 ? 0.6 : 0.4)),
    reserved: 0,
  })),
);

export const orders: Order[] = [];
export const order_items: OrderItem[] = [];
export const payments: Payment[] = [];
export const deliveries: Delivery[] = [];
export const deliveries_stops: DeliveryStop[] = [];
export const deliveries_event: DeliveryEvent[] = [];
export const deliveries_expenses: DeliveryExpense[] = [];

type Stage = "scheduled" | "in_transit" | "completed";
const cands: { order: Order; day: string; stage: Stage; failed: boolean }[] =
  [];
const addPayment = (o: Order, amount: number, at: Date) =>
  payments.push({
    id: payments.length + 1,
    payment_number: `PAY-${String(payments.length + 1).padStart(5, "0")}`,
    order_id: o.id,
    customer_id: o.customer_id,
    payment_method: pick(METHODS),
    payment_status: "PAID",
    amount: money(amount),
    received_at: at,
  });

for (let i = 0; i < 110; i++) {
  const created = new Date(NOW.getTime() - rnd() * 120 * DAY);
  const age = (NOW.getTime() - created.getTime()) / DAY;
  const w = pick(warehouses),
    c = pick(customers),
    arrangement = pick(ARRANGEMENTS);
  const stock = inventory.filter(
    (r) => r.warehouse_id === w.id && r.quantity > 0,
  );
  const chosen = new Set<Inventory>();
  const n = 1 + Math.floor(rnd() * 3);
  while (chosen.size < n) chosen.add(pick(stock));
  const cancelled = rnd() < 0.06;
  const failed = !cancelled && age >= 3 && rnd() < 0.07;
  const status: OrderStatus = cancelled
    ? "CANCELLED"
    : failed
      ? "SCHEDULING"
      : age < 1
        ? pick(["PENDING", "PROCESSING"] as const)
        : age < 3
          ? pick(["SCHEDULING", "SCHEDULED", "IN_TRANSIT"] as const)
          : "COMPLETED";
  const order: Order = {
    id: i + 1,
    order_number: `ORD-${1001 + i}`,
    warehouse_id: w.id,
    customer_id: c.id,
    payment_arrangement: arrangement,
    status,
    created_at: created,
  };
  orders.push(order);
  let total = 0;
  chosen.forEach((inv) => {
    const quantity = 1 + Math.floor(rnd() * 25);
    total +=
      quantity * Number(product_variants[inv.product_variant_id - 1].price);
    order_items.push({
      id: order_items.length + 1,
      order_id: order.id,
      inventory_id: inv.id,
      quantity,
      created_at: created,
    });
  });
  if (
    status === "SCHEDULED" ||
    status === "IN_TRANSIT" ||
    status === "COMPLETED" ||
    failed
  ) {
    const stage: Stage =
      status === "IN_TRANSIT"
        ? "in_transit"
        : status === "SCHEDULED"
          ? "scheduled"
          : "completed";
    cands.push({
      order,
      stage,
      failed,
      day: manilaDay(
        new Date(
          stage === "scheduled" ? NOW.getTime() + DAY : created.getTime() + DAY,
        ),
      ),
    });
  }
  const payAt = (d: number) => cap(created.getTime() + d * DAY);
  if (!cancelled) {
    if (arrangement === "FULLY_PAID") addPayment(order, total, created);
    else if (arrangement === "PARTIALLY_PAID") {
      const dep = Math.round(total * (0.3 + rnd() * 0.4));
      addPayment(order, dep, created);
      if (age > 20 && rnd() < 0.5)
        addPayment(
          order,
          total - dep,
          payAt(5 + rnd() * Math.min(age - 5, 30)),
        );
    } else if (arrangement === "PAY_ON_DELIVERY") {
      if (status === "COMPLETED") addPayment(order, total, payAt(1.5));
    } else if (age > 5 && rnd() < 0.5)
      addPayment(
        order,
        rnd() < 0.8 ? total : Math.round(total * 0.5),
        payAt(5 + rnd() * Math.min(age - 5, 35)),
      );
  }
}

// reserved = units on orders that are neither completed nor cancelled
const open = new Set(
  orders
    .filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED")
    .map((o) => o.id),
);
order_items
  .filter((it) => open.has(it.order_id))
  .forEach((it) => {
    const r = inventory[it.inventory_id - 1];
    r.reserved = Math.min(r.quantity, r.reserved + it.quantity);
  });

// group candidate orders into deliveries of up to 3 stops (same warehouse, day and stage)
const groups = new Map<string, typeof cands>();
cands.forEach((c) => {
  const k = `${c.order.warehouse_id}|${c.day}|${c.stage}`;
  groups.set(k, [...(groups.get(k) ?? []), c]);
});
const perDay = new Map<string, number>();
groups.forEach((list, key) => {
  const [wh, day, stage] = key.split("|");
  for (let s = 0; s < list.length; s += 3) {
    const slot = perDay.get(day) ?? 0;
    perDay.set(day, slot + 1);
    const hh = String(6 + slot).padStart(2, "0");
    const departure = new Date(`${day}T${hh}:00:00+08:00`);
    const type = pick([
      "INTERNAL",
      "INTERNAL",
      "INTERNAL",
      "LALAMOVE",
      "PICKUP",
    ] as const);
    const d: Delivery = {
      id: deliveries.length + 1,
      driver_id: pick(drivers.filter((x) => x.warehouse_id === +wh)).id,
      vehicle_id: pick(vehicles.filter((x) => x.warehouse_id === +wh)).id,
      scheduled_date: day,
      departure_time: `${hh}:00:00`,
      delivery_type: type,
      status: stage as Stage,
    };
    deliveries.push(d);
    list.slice(s, s + 3).forEach((c, leg) => {
      const done = stage === "completed";
      const at = new Date(
        departure.getTime() + (40 + leg * 35 + rnd() * 30) * MIN,
      );
      deliveries_stops.push({
        id: deliveries_stops.length + 1,
        delivery_id: d.id,
        order_id: c.order.id,
        leg_index: leg,
        status: !done ? "pending" : c.failed ? "failed" : "delivered",
        delivered_at: done ? at : null,
      });
      if (c.failed)
        deliveries_event.push({
          id: deliveries_event.length + 1,
          delivery_id: d.id,
          event_type: "FAILED",
          reason: pick([
            "Customer unreachable",
            "Site closed",
            "Wrong address",
          ]),
          created_at: at,
        });
    });
    if (rnd() < 0.1)
      deliveries_event.push({
        id: deliveries_event.length + 1,
        delivery_id: d.id,
        event_type: "DELAYED",
        reason: pick(["Heavy traffic", "Truck breakdown"]),
        created_at: departure,
      });
    if (stage === "completed" && type === "INTERNAL")
      deliveries_expenses.push({
        id: deliveries_expenses.length + 1,
        delivery_id: d.id,
        delivery_allowance: money(300),
        fuel: money(400 + rnd() * 600),
        toll: money(rnd() * 300),
        status: pick([
          "approved",
          "approved",
          "approved",
          "pending",
          "rejected",
        ] as const),
      });
  }
});
