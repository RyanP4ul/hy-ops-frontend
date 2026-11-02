// MOCK DATA ONLY — deterministic sample records for the UI phase. Replace with API data in Phase 5.
export type Arrangement = "FULLY_PAID" | "PARTIALLY_PAID" | "NET_30";
export type PayStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
export type DeliveryStatus = "SCHEDULED" | "COMPLETED" | "FAILED" | "CANCELLED";
export type DeliveryType = "INTERNAL" | "LALAMOVE" | "PICKUP";
export type OrderStatus = "COMPLETED" | "PROCESSING" | "CANCELLED";

export interface Order {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  customer: string;
  product: string;
  category: string;
  warehouse: string;
  qty: number;
  total: number;
  paid: number;
  arrangement: Arrangement;
  payStatus: PayStatus;
  orderStatus: OrderStatus;
  deliveryStatus: DeliveryStatus;
  deliveryType: DeliveryType;
  vehicle: string;
  durationMin: number;
}

export const TODAY = new Date("2026-10-22T00:00:00+08:00"); // Asia/Manila business date
export const CUSTOMERS = [
  "Santos Hardware",
  "Reyes Trading",
  "Dela Cruz Builders",
  "Lim Construction",
  "Garcia Supply",
  "Bautista Depot",
];
export const PRODUCTS = [
  {
    name: "Portland Cement 40kg",
    sku: "CEM-040",
    category: "Cement",
    price: 280,
    stock: 420,
    reserved: 60,
    threshold: 150,
  },
  {
    name: "Rebar 10mm x 6m",
    sku: "REB-010",
    category: "Steel",
    price: 310,
    stock: 90,
    reserved: 40,
    threshold: 120,
  },
  {
    name: "Concrete Nails 3in (kg)",
    sku: "NAI-003",
    category: "Fasteners",
    price: 95,
    stock: 0,
    reserved: 0,
    threshold: 50,
  },
  {
    name: "Marine Plywood 3/4",
    sku: "PLY-034",
    category: "Wood",
    price: 1450,
    stock: 35,
    reserved: 10,
    threshold: 40,
  },
  {
    name: "Gloss Paint 4L",
    sku: "PNT-004",
    category: "Paint",
    price: 890,
    stock: 210,
    reserved: 25,
    threshold: 60,
  },
  {
    name: "GI Sheet 0.4mm",
    sku: "GIS-004",
    category: "Steel",
    price: 560,
    stock: 150,
    reserved: 20,
    threshold: 80,
  },
];
export const CATEGORIES = [...new Set(PRODUCTS.map((p) => p.category))];
export const VEHICLES = ["Truck 01", "Truck 02", "Van 01", "Third-party"];
export const WAREHOUSES = ["Meycauayan", "Valenzuela"];

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const ORDERS: Order[] = Array.from({ length: 90 }, (_, i): Order => {
  const date = new Date(TODAY.getTime() - Math.floor(rnd() * 120) * 864e5);
  const due = new Date(date.getTime() + 30 * 864e5);
  const product = pick(PRODUCTS);
  const qty = 1 + Math.floor(rnd() * 40);
  const total = qty * product.price;
  const arrangement = pick<Arrangement>([
    "FULLY_PAID",
    "PARTIALLY_PAID",
    "NET_30",
  ]);
  const cancelled = rnd() < 0.07;
  const paid =
    arrangement === "FULLY_PAID"
      ? total
      : arrangement === "PARTIALLY_PAID"
        ? Math.round(total * (0.3 + rnd() * 0.5))
        : rnd() < 0.3
          ? total
          : 0;
  const balance = cancelled ? 0 : total - paid;
  const payStatus: PayStatus =
    balance === 0
      ? "PAID"
      : (arrangement === "NET_30" && due < TODAY) ||
          (arrangement !== "NET_30" &&
            date.getTime() < TODAY.getTime() - 45 * 864e5)
        ? "OVERDUE"
        : paid > 0
          ? "PARTIALLY_PAID"
          : "UNPAID";
  const deliveryType = pick<DeliveryType>([
    "INTERNAL",
    "INTERNAL",
    "LALAMOVE",
    "PICKUP",
  ]);
  const age = (TODAY.getTime() - date.getTime()) / 864e5;
  const deliveryStatus: DeliveryStatus = cancelled
    ? "CANCELLED"
    : age < 2
      ? "SCHEDULED"
      : rnd() < 0.08
        ? "FAILED"
        : "COMPLETED";
  return {
    id: `o${i}`,
    number: `HY-${String(2400 + i)}`,
    date: iso(date),
    dueDate: iso(due),
    customer: pick(CUSTOMERS),
    product: product.name,
    category: product.category,
    warehouse: pick(WAREHOUSES),
    qty,
    total,
    paid: cancelled ? 0 : paid,
    arrangement,
    payStatus,
    orderStatus: cancelled ? "CANCELLED" : age < 2 ? "PROCESSING" : "COMPLETED",
    deliveryStatus,
    deliveryType,
    vehicle:
      deliveryType === "INTERNAL"
        ? pick(VEHICLES.slice(0, 3))
        : deliveryType === "LALAMOVE"
          ? "Third-party"
          : "—",
    durationMin: 40 + Math.floor(rnd() * 140),
  };
}).sort((a, b) => b.date.localeCompare(a.date));
