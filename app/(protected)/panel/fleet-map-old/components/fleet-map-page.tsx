"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MapControls,
  MapRoute,
  type MapRef,
} from "@/components/ui/map";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  MapPin,
  Package,
  PanelLeft,
  PanelLeftClose,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Send,
  Trash2,
  Truck,
  UserRound,
  Warehouse,
  X,
} from "lucide-react";

type Coordinates = [number, number];

type WarehouseLocation = {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
};

type PaymentArrangement = "FULLY_PAID" | "PARTIALLY_PAID" | "NET_30";
type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type OrderDetails = {
  id: string;
  customer: {
    name: string;
    code: string;
    phone: string;
  };
  paymentArrangement: PaymentArrangement;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  amountPaid: number;
  dueDate?: string;
  items: OrderItem[];
};

type DeliveryStop = {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  status: "pending" | "completed";
  order: OrderDetails;
};

type TripMeta = {
  id: string;
  label: string;
  scheduledAt: string; // ISO 8601 with offset, e.g. 2026-10-24T09:00:00+08:00
};

type Trip = TripMeta & {
  stops: DeliveryStop[];
};

type Vehicle = {
  id: string;
  driver: string;
  plate: string;
  color: string; // REQUIRED
  warehouseId: string;
  trip: TripMeta; // the trip the vehicle is running (or just finished)
  stops: DeliveryStop[]; // stops of the current trip
  scheduledTrips: Trip[]; // upcoming trips, earliest first
  legIndex: number; // by default use 0 and no need to put this in json property
  progress: number; // NOT REQUIRED
  completedStops: number;
  status: "delivering" | "returning" | "available";
  speed: number;
};

type DetailsTab = "current" | "scheduled";
type SidebarView = "vehicles" | "schedule";

type WarehouseFormState = {
  name: string;
  address: string;
  longitude: string;
  latitude: string;
};

const INITIAL_WAREHOUSES: WarehouseLocation[] = [
  {
    id: "WH-01",
    name: "Main Warehouse",
    address: "Quezon City",
    coordinates: [121.0437, 14.676],
  },
  {
    id: "WH-02",
    name: "South Warehouse",
    address: "Makati City",
    coordinates: [121.0244, 14.5547],
  },
];

const EMPTY_WAREHOUSE_FORM: WarehouseFormState = {
  name: "",
  address: "",
  longitude: "",
  latitude: "",
};

type StopSeed = {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  orderId: string;
  customer: [name: string, code: string, phone: string];
  arrangement: PaymentArrangement;
  method: PaymentMethod;
  paid?: number; // only needed for PARTIALLY_PAID
  dueDate?: string;
  status?: DeliveryStop["status"];
  items: [name: string, quantity: number, unitPrice: number][];
};

// Compact builder so the seeded trips stay readable.
// Totals are derived from the items; "paid" follows the payment arrangement.
function createStop(seed: StopSeed): DeliveryStop {
  const items: OrderItem[] = seed.items.map(
    ([name, quantity, unitPrice], index) => ({
      id: `ITEM-${seed.orderId.replace("ORD-", "")}-${index + 1}`,
      name,
      quantity,
      unitPrice,
    }),
  );
  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const amountPaid =
    seed.arrangement === "FULLY_PAID"
      ? totalAmount
      : seed.arrangement === "NET_30"
        ? 0
        : (seed.paid ?? 0);

  return {
    id: seed.id,
    name: seed.name,
    address: seed.address,
    coordinates: seed.coordinates,
    status: seed.status ?? "pending",
    order: {
      id: seed.orderId,
      customer: {
        name: seed.customer[0],
        code: seed.customer[1],
        phone: seed.customer[2],
      },
      paymentArrangement: seed.arrangement,
      paymentMethod: seed.method,
      totalAmount,
      amountPaid,
      dueDate: seed.dueDate,
      items,
    },
  };
}

const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: "VH-101",
    driver: "Juan Dela Cruz",
    plate: "ABC-1234",
    color: "#2563eb",
    warehouseId: "WH-01",
    legIndex: 0,
    progress: 0,
    completedStops: 0,
    status: "delivering",
    speed: 38,
    trip: {
      id: "TRIP-101-A",
      label: "Morning run",
      scheduledAt: "2026-10-23T08:00:00+08:00",
    },
    scheduledTrips: [
      {
        id: "TRIP-101-B",
        label: "Afternoon run",
        scheduledAt: "2026-10-23T14:00:00+08:00",
        stops: [
          createStop({
            id: "ST-08",
            name: "Marikina Delivery",
            address: "Marikina City",
            coordinates: [121.1029, 14.6507],
            orderId: "ORD-1049",
            customer: ["Marikina Home Supply", "CUS-0008", "0917-555-0108"],
            arrangement: "PARTIALLY_PAID",
            method: "BANK_TRANSFER",
            paid: 25000,
            items: [
              ["Plywood sheets", 60, 780],
              ["Common nails", 100, 120],
            ],
          }),
          createStop({
            id: "ST-09",
            name: "San Juan Delivery",
            address: "San Juan City",
            coordinates: [121.03, 14.6019],
            orderId: "ORD-1050",
            customer: ["San Juan Paint & Tools", "CUS-0009", "0917-555-0109"],
            arrangement: "FULLY_PAID",
            method: "CASH",
            items: [
              ["Paint pails", 30, 1250],
              ["Paint rollers", 80, 95],
            ],
          }),
        ],
      },
      {
        id: "TRIP-101-C",
        label: "Next-day north run",
        scheduledAt: "2026-10-24T08:30:00+08:00",
        stops: [
          createStop({
            id: "ST-10",
            name: "Caloocan Delivery",
            address: "Caloocan City",
            coordinates: [120.983, 14.65],
            orderId: "ORD-1051",
            customer: ["Caloocan Builders Hub", "CUS-0010", "0917-555-0110"],
            arrangement: "NET_30",
            method: "BANK_TRANSFER",
            dueDate: "Nov 23, 2026",
            items: [["Cement", 120, 660]],
          }),
          createStop({
            id: "ST-11",
            name: "Valenzuela Delivery",
            address: "Valenzuela City",
            coordinates: [120.983, 14.7011],
            orderId: "ORD-1052",
            customer: ["Valenzuela Steel Works", "CUS-0011", "0917-555-0111"],
            arrangement: "PARTIALLY_PAID",
            method: "CARD",
            paid: 30000,
            items: [
              ["Steel channels", 25, 1770],
              ["Angle bars", 40, 865],
            ],
          }),
        ],
      },
    ],
    stops: [
      {
        id: "ST-01",
        name: "Cubao Delivery",
        address: "Cubao, Quezon City",
        coordinates: [121.0567, 14.6195],
        status: "pending",
        order: {
          id: "ORD-1042",
          customer: {
            name: "Cubao Hardware Trading",
            code: "CUS-0001",
            phone: "0917-555-0101",
          },
          paymentArrangement: "PARTIALLY_PAID",
          paymentMethod: "BANK_TRANSFER",
          totalAmount: 48500,
          amountPaid: 20000,
          items: [
            {
              id: "ITEM-1042-1",
              name: "Steel bars",
              quantity: 50,
              unitPrice: 650,
            },
            { id: "ITEM-1042-2", name: "Cement", quantity: 25, unitPrice: 640 },
          ],
        },
      },
      {
        id: "ST-02",
        name: "Ortigas Delivery",
        address: "Ortigas Center, Pasig",
        coordinates: [121.056, 14.5865],
        status: "pending",
        order: {
          id: "ORD-1043",
          customer: {
            name: "Ortigas Builders Supply",
            code: "CUS-0002",
            phone: "0917-555-0102",
          },
          paymentArrangement: "FULLY_PAID",
          paymentMethod: "CASH",
          totalAmount: 36200,
          amountPaid: 36200,
          items: [
            {
              id: "ITEM-1043-1",
              name: "PVC pipes",
              quantity: 40,
              unitPrice: 520,
            },
            {
              id: "ITEM-1043-2",
              name: "Pipe fittings",
              quantity: 60,
              unitPrice: 253.33,
            },
          ],
        },
      },
      {
        id: "ST-03",
        name: "Makati Delivery",
        address: "Makati City",
        coordinates: [121.0244, 14.5547],
        status: "pending",
        order: {
          id: "ORD-1044",
          customer: {
            name: "Makati Industrial Depot",
            code: "CUS-0003",
            phone: "0917-555-0103",
          },
          paymentArrangement: "NET_30",
          paymentMethod: "BANK_TRANSFER",
          totalAmount: 72400,
          amountPaid: 0,
          dueDate: "Nov 19, 2026",
          items: [
            {
              id: "ITEM-1044-1",
              name: "GI sheets",
              quantity: 80,
              unitPrice: 780,
            },
            {
              id: "ITEM-1044-2",
              name: "Roofing screws",
              quantity: 25,
              unitPrice: 400,
            },
          ],
        },
      },
    ],
  },
  {
    id: "VH-102",
    driver: "Maria Santos",
    plate: "XYZ-5678",
    color: "#16a34a",
    warehouseId: "WH-01",
    legIndex: 0,
    progress: 0,
    completedStops: 0,
    status: "delivering",
    speed: 32,
    trip: {
      id: "TRIP-102-B",
      label: "Midday run",
      scheduledAt: "2026-10-23T11:00:00+08:00",
    },
    scheduledTrips: [
      {
        id: "TRIP-102-C",
        label: "Evening run",
        scheduledAt: "2026-10-23T15:30:00+08:00",
        stops: [
          createStop({
            id: "ST-12",
            name: "Mandaluyong Delivery",
            address: "Mandaluyong City",
            coordinates: [121.0359, 14.5794],
            orderId: "ORD-1053",
            customer: ["Mandaluyong Electrical", "CUS-0012", "0917-555-0112"],
            arrangement: "FULLY_PAID",
            method: "CASH",
            items: [["Electrical wire rolls", 35, 1490]],
          }),
          createStop({
            id: "ST-13",
            name: "Pasay Delivery",
            address: "Pasay City",
            coordinates: [121.0, 14.5378],
            orderId: "ORD-1054",
            customer: ["Pasay Port Logistics", "CUS-0013", "0917-555-0113"],
            arrangement: "NET_30",
            method: "BANK_TRANSFER",
            dueDate: "Nov 22, 2026",
            items: [
              ["PVC pipes", 55, 520],
              ["Valves", 20, 940],
            ],
          }),
        ],
      },
    ],
    stops: [
      {
        id: "ST-04",
        name: "Manila Delivery",
        address: "Manila",
        coordinates: [120.9842, 14.5995],
        status: "pending",
        order: {
          id: "ORD-1045",
          customer: {
            name: "Manila General Merchandise",
            code: "CUS-0004",
            phone: "0917-555-0104",
          },
          paymentArrangement: "NET_30",
          paymentMethod: "BANK_TRANSFER",
          totalAmount: 59400,
          amountPaid: 0,
          dueDate: "Nov 20, 2026",
          items: [
            { id: "ITEM-1045-1", name: "Cement", quantity: 90, unitPrice: 660 },
          ],
        },
      },
      {
        id: "ST-05",
        name: "BGC Delivery",
        address: "Bonifacio Global City",
        coordinates: [121.05, 14.5494],
        status: "pending",
        order: {
          id: "ORD-1046",
          customer: {
            name: "BGC Construction Trading",
            code: "CUS-0005",
            phone: "0917-555-0105",
          },
          paymentArrangement: "PARTIALLY_PAID",
          paymentMethod: "CARD",
          totalAmount: 42800,
          amountPaid: 15000,
          items: [
            {
              id: "ITEM-1046-1",
              name: "Rebar bundles",
              quantity: 40,
              unitPrice: 1070,
            },
          ],
        },
      },
    ],
  },
  {
    id: "VH-103",
    driver: "Pedro Reyes",
    plate: "DEF-9012",
    color: "#9333ea",
    warehouseId: "WH-02",
    legIndex: 0,
    progress: 0,
    completedStops: 0,
    status: "delivering",
    speed: 35,
    trip: {
      id: "TRIP-103-A",
      label: "Pasig run",
      scheduledAt: "2026-10-23T09:00:00+08:00",
    },
    scheduledTrips: [
      {
        id: "TRIP-103-B",
        label: "South-side run",
        scheduledAt: "2026-10-24T09:00:00+08:00",
        stops: [
          createStop({
            id: "ST-14",
            name: "Taguig Delivery",
            address: "Taguig City",
            coordinates: [121.0509, 14.5176],
            orderId: "ORD-1055",
            customer: ["Taguig Modern Interiors", "CUS-0014", "0917-555-0114"],
            arrangement: "PARTIALLY_PAID",
            method: "BANK_TRANSFER",
            paid: 20000,
            items: [
              ["GI sheets", 50, 780],
              ["Roofing screws", 30, 400],
            ],
          }),
          createStop({
            id: "ST-15",
            name: "Parañaque Delivery",
            address: "Parañaque City",
            coordinates: [121.0198, 14.4793],
            orderId: "ORD-1056",
            customer: ["Parañaque Roofing Depot", "CUS-0015", "0917-555-0115"],
            arrangement: "FULLY_PAID",
            method: "CARD",
            items: [["Roof sealant", 40, 1100]],
          }),
        ],
      },
    ],
    stops: [
      {
        id: "ST-06",
        name: "Pasig Delivery",
        address: "Pasig City",
        coordinates: [121.056, 14.5865],
        status: "pending",
        order: {
          id: "ORD-1047",
          customer: {
            name: "Pasig Trade Center",
            code: "CUS-0006",
            phone: "0917-555-0106",
          },
          paymentArrangement: "FULLY_PAID",
          paymentMethod: "CASH",
          totalAmount: 28100,
          amountPaid: 28100,
          items: [
            {
              id: "ITEM-1047-1",
              name: "Electrical conduit",
              quantity: 70,
              unitPrice: 401.43,
            },
          ],
        },
      },
      {
        id: "ST-07",
        name: "Ortigas Delivery",
        address: "Ortigas Center, Pasig",
        coordinates: [121.056, 14.579],
        status: "pending",
        order: {
          id: "ORD-1048",
          customer: {
            name: "Greenline Hardware",
            code: "CUS-0007",
            phone: "0917-555-0107",
          },
          paymentArrangement: "PARTIALLY_PAID",
          paymentMethod: "BANK_TRANSFER",
          totalAmount: 53100,
          amountPaid: 18000,
          items: [
            {
              id: "ITEM-1048-1",
              name: "Steel channels",
              quantity: 30,
              unitPrice: 1770,
            },
          ],
        },
      },
    ],
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

function getPaymentArrangementLabel(arrangement: PaymentArrangement): string {
  switch (arrangement) {
    case "FULLY_PAID":
      return "Fully paid";
    case "PARTIALLY_PAID":
      return "Partially paid";
    case "NET_30":
      return "Net 30";
  }
}

function isRouteComplete(vehicle: Vehicle): boolean {
  // This route includes the return leg, so it is complete when all stops are done
  // and the vehicle has returned to its assigned warehouse.
  return (
    vehicle.status === "available" &&
    vehicle.stops.length > 0 &&
    vehicle.stops.every((stop) => stop.status === "completed")
  );
}

function interpolate(
  start: Coordinates,
  end: Coordinates,
  progress: number,
): Coordinates {
  return [
    start[0] + (end[0] - start[0]) * progress,
    start[1] + (end[1] - start[1]) * progress,
  ];
}

function getWarehouse(
  vehicle: Vehicle,
  warehouses: WarehouseLocation[],
): WarehouseLocation {
  return (
    warehouses.find((warehouse) => warehouse.id === vehicle.warehouseId) ??
    warehouses[0] ??
    INITIAL_WAREHOUSES[0]!
  );
}

// Route: assigned warehouse -> delivery stops -> assigned warehouse.
function getRoute(
  vehicle: Vehicle,
  warehouses: WarehouseLocation[],
): Coordinates[] {
  const warehouse = getWarehouse(vehicle, warehouses);

  return [
    warehouse.coordinates,
    ...vehicle.stops.map((stop) => stop.coordinates),
    warehouse.coordinates,
  ];
}

function getPosition(
  vehicle: Vehicle,
  warehouses: WarehouseLocation[],
): Coordinates {
  const warehouse = getWarehouse(vehicle, warehouses);
  const fallback: Coordinates = warehouse.coordinates ?? [121.035, 14.603];
  const route = getRoute(vehicle, warehouses);

  if (vehicle.status === "available") {
    return fallback;
  }

  const start = route[vehicle.legIndex];
  const end = route[vehicle.legIndex + 1];

  if (!start || !end) {
    return fallback;
  }

  return interpolate(start, end, vehicle.progress);
}

function getNextDestination(vehicle: Vehicle, warehouses: WarehouseLocation[]) {
  if (vehicle.status === "available" || vehicle.status === "returning") {
    return getWarehouse(vehicle, warehouses);
  }

  return vehicle.stops[vehicle.legIndex];
}

const SCHEDULE_TIME_ZONE = "Asia/Manila"; // fixed zone keeps SSR and client output identical

function formatSchedule(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: SCHEDULE_TIME_ZONE,
  }).format(new Date(iso));
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: SCHEDULE_TIME_ZONE,
  }).format(new Date(iso));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: SCHEDULE_TIME_ZONE,
  }).format(new Date(iso));
}

function getTripValue(stops: DeliveryStop[]): number {
  return stops.reduce((sum, stop) => sum + stop.order.totalAmount, 0);
}

function getProgressPercent(vehicle: Vehicle): number {
  if (vehicle.stops.length === 0) return 0;
  return Math.round((vehicle.completedStops / vehicle.stops.length) * 100);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

// Moves the next (or a specific) scheduled trip onto the vehicle and sends it out.
// The trip that just finished is dropped from the vehicle.
function dispatchNextTrip(vehicle: Vehicle, tripId?: string): Vehicle {
  if (vehicle.status !== "available") return vehicle;

  const next = tripId
    ? vehicle.scheduledTrips.find((trip) => trip.id === tripId)
    : vehicle.scheduledTrips[0];
  if (!next) return vehicle;

  return {
    ...vehicle,
    trip: { id: next.id, label: next.label, scheduledAt: next.scheduledAt },
    stops: next.stops.map((stop) => ({ ...stop, status: "pending" as const })),
    scheduledTrips: vehicle.scheduledTrips.filter(
      (trip) => trip.id !== next.id,
    ),
    completedStops: 0,
    legIndex: 0,
    progress: 0,
    status: "delivering",
    speed: 35,
  };
}

function advanceVehicle(vehicle: Vehicle, autoDispatch: boolean): Vehicle {
  if (vehicle.status === "available") {
    // Idle at the warehouse: optionally pick up the next scheduled trip.
    return autoDispatch ? dispatchNextTrip(vehicle) : vehicle;
  }

  // Increase movement progress every tick.
  const nextProgress = vehicle.progress + 0.025;

  if (nextProgress < 1) {
    return {
      ...vehicle,
      progress: nextProgress,
      speed: 30 + Math.floor(Math.random() * 16),
    };
  }

  // The vehicle has reached its current destination.
  const nextLegIndex = vehicle.legIndex + 1;

  // Reached a delivery stop.
  if (vehicle.status === "delivering") {
    const arrivedStopIndex = vehicle.legIndex;
    const updatedStops = vehicle.stops.map((stop, index) =>
      index === arrivedStopIndex
        ? { ...stop, status: "completed" as const }
        : stop,
    );

    const completedStops = updatedStops.filter(
      (stop) => stop.status === "completed",
    ).length;

    const allStopsCompleted = updatedStops.every(
      (stop) => stop.status === "completed",
    );

    return {
      ...vehicle,
      stops: updatedStops,
      completedStops,
      legIndex: nextLegIndex,
      progress: 0,
      status: allStopsCompleted ? "returning" : "delivering",
      speed: 35,
    };
  }

  // The vehicle is returning and has reached its warehouse.
  return {
    ...vehicle,
    legIndex: 0,
    progress: 0,
    status: "available",
    speed: 0,
  };
}

// Applies a payment arrangement change to a single stop's order.
function applyPaymentArrangement(
  stop: DeliveryStop,
  arrangement: PaymentArrangement,
): DeliveryStop {
  const totalAmount = stop.order.totalAmount;
  let amountPaid = stop.order.amountPaid;
  if (arrangement === "FULLY_PAID") {
    amountPaid = totalAmount;
  } else if (arrangement === "NET_30") {
    amountPaid = 0;
  } else if (amountPaid <= 0 || amountPaid >= totalAmount) {
    amountPaid = Math.min(Math.round(totalAmount * 0.35), totalAmount - 1);
  }

  let dueDate = stop.order.dueDate;
  if (arrangement === "NET_30" && !dueDate) {
    const due = new Date();
    due.setDate(due.getDate() + 30);
    dueDate = due.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return {
    ...stop,
    order: {
      ...stop.order,
      paymentArrangement: arrangement,
      amountPaid,
      dueDate,
    },
  };
}

const STATUS_STYLES: Record<
  Vehicle["status"],
  { label: string; className: string }
> = {
  delivering: {
    label: "Delivering",
    className: "bg-green-500/10 text-green-600",
  },
  returning: {
    label: "Returning",
    className: "bg-amber-500/10 text-amber-600",
  },
  available: {
    label: "Available",
    className: "bg-blue-500/10 text-blue-600",
  },
};

function StatusBadge({ status }: { status: Vehicle["status"] }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1.5 overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${percent}%`, backgroundColor: color }}
      />
    </div>
  );
}

function SegmentedTabs<T extends string>({
  label,
  value,
  onChange,
  tabs,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: string; count?: number }[];
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid gap-1 rounded-lg bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                  active ? "bg-primary/10 text-primary" : "bg-foreground/5"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-4 py-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

// Collapsible card for one scheduled trip.
function TripCard({
  trip,
  color,
  expanded,
  onToggle,
  tag,
  footer,
  children,
}: {
  trip: Trip;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  tag?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border transition ${
        expanded ? "border-primary/40 bg-primary/5" : "bg-background"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-muted/40"
      >
        <div
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <CalendarClock className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{trip.label}</p>
            {tag}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatSchedule(trip.scheduledAt)}
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {pluralize(trip.stops.length, "stop")} ·{" "}
            {formatCurrency(getTripValue(trip.stops))}
          </p>
        </div>
        <ChevronDown
          className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="space-y-2 border-t p-3">
          {children}
          {footer}
        </div>
      )}
    </div>
  );
}

// One delivery stop with its order popover. Reused by the current and scheduled lists.
function StopRow({
  stop,
  index,
  orderOpen,
  onOrderOpenChange,
  onPaymentChange,
}: {
  stop: DeliveryStop;
  index: number;
  orderOpen: boolean;
  onOrderOpenChange: (open: boolean) => void;
  onPaymentChange: (orderId: string, arrangement: PaymentArrangement) => void;
}) {
  const completed = stop.status === "completed";

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
      {completed ? (
        <CheckCircle2 className="size-5 shrink-0 text-green-600" />
      ) : (
        <Clock3 className="size-5 shrink-0 text-amber-500" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {index + 1}. {stop.name}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {stop.address}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {stop.order.id} · {formatCurrency(stop.order.totalAmount)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-medium ${
            completed
              ? "bg-green-500/10 text-green-600"
              : "bg-amber-500/10 text-amber-700"
          }`}
        >
          {completed ? "Completed" : "Pending"}
        </span>
        <Popover open={orderOpen} onOpenChange={onOrderOpenChange}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition hover:bg-muted"
              >
                View order
              </button>
            }
          />
          <PopoverContent
            side="right"
            align="start"
            className="z-[100] max-h-[min(70vh,640px)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-0"
          >
            <div className="overflow-hidden rounded-lg">
              <div className="flex items-start justify-between gap-3 border-b bg-muted/30 p-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">ORDER DETAILS</p>
                  <p className="mt-1 text-sm font-semibold">{stop.order.id}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                  {getPaymentArrangementLabel(stop.order.paymentArrangement)}
                </span>
              </div>

              <div className="space-y-3 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <UserRound className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {stop.order.customer.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {stop.order.customer.code} · {stop.order.customer.phone}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={`payment-arrangement-${stop.order.id}`}
                    className="flex items-center gap-2 text-xs font-semibold"
                  >
                    <CreditCard className="size-3.5 text-muted-foreground" />
                    Payment arrangement
                  </label>
                  <select
                    id={`payment-arrangement-${stop.order.id}`}
                    value={stop.order.paymentArrangement}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      onPaymentChange(
                        stop.order.id,
                        event.target.value as PaymentArrangement,
                      )
                    }
                    className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="FULLY_PAID">Fully paid</option>
                    <option value="PARTIALLY_PAID">Partially paid</option>
                    <option value="NET_30">Net 30</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs font-semibold">
                    <Package className="size-3.5 text-muted-foreground" />
                    Items
                  </p>
                  {stop.order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 text-xs"
                    >
                      <span className="min-w-0 flex-1 text-muted-foreground">
                        {item.name} × {item.quantity}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      Payment method
                    </span>
                    <span className="font-medium">
                      {stop.order.paymentMethod.replaceAll("_", " ")}
                    </span>
                  </div>
                  {stop.order.paymentArrangement === "NET_30" &&
                    stop.order.dueDate && (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Due date</span>
                        <span className="font-medium">
                          {stop.order.dueDate}
                        </span>
                      </div>
                    )}
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Order total</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(stop.order.totalAmount)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Amount paid</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(stop.order.amountPaid)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3 border-t pt-2">
                    <span className="font-medium">Balance due</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(
                        Math.max(
                          0,
                          stop.order.totalAmount - stop.order.amountPaid,
                        ),
                      )}
                    </span>
                  </div>
                </div>
                {stop.order.paymentArrangement === "NET_30" && (
                  <p className="text-[11px] text-muted-foreground">
                    Net 30 orders are payable within 30 days of the agreed
                    invoice/credit date. Track the actual due date in the order
                    record.
                  </p>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export default function FleetMap() {
  const [vehicles, setVehicles] = useState(INITIAL_VEHICLES);
  const [warehouses, setWarehouses] = useState(INITIAL_WAREHOUSES);
  const [selectedId, setSelectedId] = useState("VH-101");
  const [isRunning, setIsRunning] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [warehouseManagerOpen, setWarehouseManagerOpen] = useState(false);
  const [warehouseFormOpen, setWarehouseFormOpen] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(
    null,
  );
  const [warehouseForm, setWarehouseForm] =
    useState<WarehouseFormState>(EMPTY_WAREHOUSE_FORM);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [orderPopoverOpenId, setOrderPopoverOpenId] = useState<string | null>(
    null,
  );
  const [focusedWarehouseId, setFocusedWarehouseId] = useState<string | null>(
    null,
  );
  const mapRef = useRef<MapRef>(null);

  const [sidebarView, setSidebarView] = useState<SidebarView>("vehicles");
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("current");
  // Id of the scheduled/completed trip currently expanded and drawn on the map.
  const [previewTripId, setPreviewTripId] = useState<string | null>(null);
  // When on, an idle vehicle automatically starts its next scheduled trip.
  const [autoDispatch, setAutoDispatch] = useState(false);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setVehicles((current) =>
        current.map((vehicle) => advanceVehicle(vehicle, autoDispatch)),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, autoDispatch]);

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedId) ??
    vehicles[0] ??
    INITIAL_VEHICLES[0]!;

  const activeCount = vehicles.filter(
    (vehicle) =>
      vehicle.status === "delivering" || vehicle.status === "returning",
  ).length;

  const allStops = vehicles.flatMap((vehicle) =>
    vehicle.stops.map((stop) => ({
      ...stop,
      vehicleId: vehicle.id,
      color: isRouteComplete(vehicle) ? vehicle.color : "#94a3b8",
    })),
  );

  const completedCount = allStops.filter(
    (stop) => stop.status === "completed",
  ).length;

  const selectedWarehouse = getWarehouse(selectedVehicle, warehouses);
  const selectedPosition = getPosition(selectedVehicle, warehouses);
  const nextDestination = getNextDestination(selectedVehicle, warehouses);
  function selectVehicle(vehicle: Vehicle) {
    setSelectedId(vehicle.id);
    setOrderPopoverOpenId(null);
    setPreviewTripId(null);

    // Center and zoom the map on the vehicle's current simulated position.
    // This is shared by sidebar selection and vehicle-marker clicks.
    mapRef.current?.easeTo({
      center: getPosition(vehicle, warehouses),
      zoom: 14,
      duration: 800,
    });
  }

  function focusWarehouse(warehouse: WarehouseLocation) {
    setFocusedWarehouseId(warehouse.id);
    mapRef.current?.easeTo({
      center: warehouse.coordinates,
      zoom: 14,
      duration: 800,
    });
  }

  function startEditingWarehouse(warehouse: WarehouseLocation) {
    setEditingWarehouseId(warehouse.id);
    setWarehouseForm({
      name: warehouse.name,
      address: warehouse.address,
      longitude: String(warehouse.coordinates[0]),
      latitude: String(warehouse.coordinates[1]),
    });
    setWarehouseError(null);
    setWarehouseFormOpen(true);
  }

  function resetWarehouseForm() {
    setEditingWarehouseId(null);
    setWarehouseForm(EMPTY_WAREHOUSE_FORM);
    setWarehouseError(null);
    setWarehouseFormOpen(false);
  }

  function handleWarehouseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const longitude = Number(warehouseForm.longitude);
    const latitude = Number(warehouseForm.latitude);

    if (!warehouseForm.name.trim() || !warehouseForm.address.trim()) {
      setWarehouseError("Enter both the warehouse name and address.");
      return;
    }

    if (
      !warehouseForm.longitude.trim() ||
      !warehouseForm.latitude.trim() ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      setWarehouseError(
        "Enter valid longitude (-180 to 180) and latitude (-90 to 90) values.",
      );
      return;
    }

    const warehouseData: WarehouseLocation = {
      id:
        editingWarehouseId ??
        `WH-${String(
          warehouses.reduce((max, item) => {
            const match = item.id.match(/(\d+)$/);
            return Math.max(max, match ? Number(match[1]) : 0);
          }, 0) + 1,
        ).padStart(2, "0")}`,
      name: warehouseForm.name.trim(),
      address: warehouseForm.address.trim(),
      coordinates: [longitude, latitude],
    };

    if (editingWarehouseId) {
      setWarehouses((current) =>
        current.map((warehouse) =>
          warehouse.id === editingWarehouseId ? warehouseData : warehouse,
        ),
      );
    } else {
      setWarehouses((current) => [...current, warehouseData]);
    }

    resetWarehouseForm();
  }

  function deleteWarehouse(warehouse: WarehouseLocation) {
    const isAssigned = vehicles.some(
      (vehicle) => vehicle.warehouseId === warehouse.id,
    );
    if (isAssigned || warehouses.length <= 1) return;
    if (!window.confirm(`Delete ${warehouse.name}?`)) return;
    setWarehouses((current) =>
      current.filter((item) => item.id !== warehouse.id),
    );
    if (focusedWarehouseId === warehouse.id) setFocusedWarehouseId(null);
    if (editingWarehouseId === warehouse.id) resetWarehouseForm();
  }

  function assignWarehouse(vehicleId: string, warehouseId: string) {
    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === vehicleId && vehicle.status === "available"
          ? { ...vehicle, warehouseId }
          : vehicle,
      ),
    );
  }

  function updateOrderPaymentArrangement(
    orderId: string,
    arrangement: PaymentArrangement,
  ) {
    const updateStops = (stops: DeliveryStop[]) =>
      stops.map((stop) =>
        stop.order.id === orderId
          ? applyPaymentArrangement(stop, arrangement)
          : stop,
      );

    // An order can live in the current trip or in a scheduled trip.
    setVehicles((current) =>
      current.map((vehicle) => ({
        ...vehicle,
        stops: updateStops(vehicle.stops),
        scheduledTrips: vehicle.scheduledTrips.map((trip) => ({
          ...trip,
          stops: updateStops(trip.stops),
        })),
      })),
    );
  }

  // Zoom the map so the whole trip (warehouse + stops) is visible.
  function fitToTrip(vehicle: Vehicle, trip: Trip) {
    const map = mapRef.current;
    if (!map) return;

    const points = [
      getWarehouse(vehicle, warehouses).coordinates,
      ...trip.stops.map((stop) => stop.coordinates),
    ];
    const lngs = points.map((point) => point[0]);
    const lats = points.map((point) => point[1]);
    const roomForPanel = map.getContainer().clientWidth > 900;

    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      {
        padding: {
          top: 90,
          bottom: 120,
          left: roomForPanel ? 440 : 40, // keep clear of the details panel
          right: 70,
        },
        maxZoom: 14,
        duration: 800,
      },
    );
  }

  function togglePreview(vehicle: Vehicle, trip: Trip) {
    setOrderPopoverOpenId(null);
    if (previewTripId === trip.id) {
      setPreviewTripId(null);
      return;
    }
    setPreviewTripId(trip.id);
    fitToTrip(vehicle, trip);
  }

  // Used by the sidebar schedule: select the vehicle, open its Scheduled tab, preview the trip.
  function openTripFromSchedule(vehicle: Vehicle, trip: Trip) {
    setSelectedId(vehicle.id);
    setDetailsTab("scheduled");
    setDetailsOpen(true);
    setOrderPopoverOpenId(null);
    setPreviewTripId(trip.id);
    fitToTrip(vehicle, trip);
  }

  function changeDetailsTab(tab: DetailsTab) {
    setDetailsTab(tab);
    setPreviewTripId(null);
    setOrderPopoverOpenId(null);
  }

  function dispatchTrip(vehicleId: string, tripId?: string) {
    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === vehicleId ? dispatchNextTrip(vehicle, tripId) : vehicle,
      ),
    );
    setPreviewTripId(null);
    setOrderPopoverOpenId(null);
    setDetailsTab("current");
  }

  const scheduledCount = vehicles.reduce(
    (total, vehicle) => total + vehicle.scheduledTrips.length,
    0,
  );

  // Every upcoming trip across the fleet, earliest first, grouped by day.
  const upcomingTrips = vehicles
    .flatMap((vehicle) =>
      vehicle.scheduledTrips.map((trip) => ({ trip, vehicle })),
    )
    .sort(
      (a, b) => Date.parse(a.trip.scheduledAt) - Date.parse(b.trip.scheduledAt),
    );

  const scheduleByDay = upcomingTrips.reduce<
    { day: string; items: typeof upcomingTrips }[]
  >((groups, item) => {
    const day = formatDay(item.trip.scheduledAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
    return groups;
  }, []);

  const previewedTrip =
    selectedVehicle.scheduledTrips.find((trip) => trip.id === previewTripId) ??
    null;
  const nextScheduledTrip = selectedVehicle.scheduledTrips[0];

  const renderStops = (stops: DeliveryStop[]) =>
    stops.map((stop, index) => (
      <StopRow
        key={stop.id}
        stop={stop}
        index={index}
        orderOpen={orderPopoverOpenId === stop.order.id}
        onOrderOpenChange={(open) =>
          setOrderPopoverOpenId(open ? stop.order.id : null)
        }
        onPaymentChange={updateOrderPaymentArrangement}
      />
    ));

  return (
    <div className="flex h-[820px] min-h-[650px] w-full flex-col overflow-hidden rounded-2xl border bg-background text-foreground lg:flex-row">
      {/* SIDEBAR */}
      <aside
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } z-20 min-h-0 w-full shrink-0 flex-col border-b bg-background lg:w-[350px] lg:border-b-0 lg:border-r`}
      >
        <div className="border-b p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Fleet control
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Live vehicles, trips and warehouses
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsRunning((running) => !running)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition hover:bg-muted"
            >
              {isRunning ? (
                <Pause className="size-3.5" />
              ) : (
                <Play className="size-3.5" />
              )}
              {isRunning ? "Pause" : "Resume"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatCard label="Active" value={activeCount} hint="On the road" />
            <StatCard
              label="Stops done"
              value={`${completedCount}/${allStops.length}`}
              hint="Current trips"
            />
            <StatCard
              label="Scheduled"
              value={scheduledCount}
              hint="Upcoming trips"
            />
          </div>
        </div>

        <div className="border-b px-3 py-2.5">
          <SegmentedTabs<SidebarView>
            label="Sidebar view"
            value={sidebarView}
            onChange={setSidebarView}
            tabs={[
              { value: "vehicles", label: "Vehicles", count: vehicles.length },
              { value: "schedule", label: "Schedule", count: scheduledCount },
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {sidebarView === "vehicles" &&
            vehicles.map((vehicle) => {
              const selected = vehicle.id === selectedId;
              const destination = getNextDestination(vehicle, warehouses);
              const percent = getProgressPercent(vehicle);

              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => selectVehicle(vehicle)}
                  aria-pressed={selected}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-transparent hover:border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${vehicle.color}18`,
                        color: vehicle.color,
                      }}
                    >
                      <Truck className="size-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {vehicle.id}
                        </span>
                        <StatusBadge status={vehicle.status} />
                      </div>

                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {vehicle.driver} · {vehicle.plate}
                      </p>

                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {vehicle.status === "returning" ||
                        vehicle.status === "available" ? (
                          <Warehouse className="size-3.5 shrink-0" />
                        ) : (
                          <MapPin className="size-3.5 shrink-0" />
                        )}
                        <span className="truncate">
                          {destination?.name ?? "No destination"}
                        </span>
                      </p>

                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="truncate text-muted-foreground">
                          {vehicle.trip.label} · {vehicle.completedStops}/
                          {vehicle.stops.length} stops
                        </span>
                        <span
                          className="font-medium tabular-nums"
                          style={{ color: vehicle.color }}
                        >
                          {percent}%
                        </span>
                      </div>

                      <div className="mt-1">
                        <ProgressBar percent={percent} color={vehicle.color} />
                      </div>

                      {vehicle.scheduledTrips.length > 0 && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-1 text-[10px] font-medium text-muted-foreground">
                          <CalendarClock className="size-3" />
                          {pluralize(
                            vehicle.scheduledTrips.length,
                            "trip",
                          )}{" "}
                          scheduled
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

          {sidebarView === "schedule" &&
            (scheduleByDay.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="size-5" />}
                title="No upcoming trips"
                description="Trips scheduled for your vehicles will show up here."
              />
            ) : (
              scheduleByDay.map((group) => (
                <div key={group.day} className="space-y-2">
                  <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.day}
                  </p>

                  {group.items.map(({ trip, vehicle }) => {
                    const active = previewTripId === trip.id;

                    return (
                      <button
                        key={trip.id}
                        type="button"
                        onClick={() => openTripFromSchedule(vehicle, trip)}
                        aria-pressed={active}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "hover:border-border hover:bg-muted/50"
                        }`}
                      >
                        <div
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: `${vehicle.color}18`,
                            color: vehicle.color,
                          }}
                        >
                          <Truck className="size-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">
                              {trip.label}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {formatTime(trip.scheduledAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {vehicle.id} · {vehicle.driver}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {pluralize(trip.stops.length, "stop")} ·{" "}
                            {formatCurrency(getTripValue(trip.stops))}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            ))}
        </div>

        <section className="shrink-0 border-t">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setWarehouseManagerOpen((open) => !open)}
              className="flex items-center gap-2 text-sm font-semibold"
              aria-expanded={warehouseManagerOpen}
            >
              <Warehouse className="size-4 text-muted-foreground" />
              Warehouses
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {warehouses.length}
              </span>
              <ChevronDown
                className={`size-3.5 text-muted-foreground transition-transform ${warehouseManagerOpen ? "rotate-180" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                if (warehouseFormOpen) {
                  resetWarehouseForm();
                } else {
                  setEditingWarehouseId(null);
                  setWarehouseForm(EMPTY_WAREHOUSE_FORM);
                  setWarehouseError(null);
                  setWarehouseFormOpen(true);
                  setWarehouseManagerOpen(true);
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            >
              {warehouseFormOpen ? (
                <X className="size-3.5" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {warehouseFormOpen ? "Cancel" : "Add"}
            </button>
          </div>

          {warehouseManagerOpen && (
            <div className="max-h-[290px] space-y-2 overflow-y-auto px-3 pb-3">
              {warehouses.map((warehouse) => {
                const assignedVehicles = vehicles.filter(
                  (vehicle) => vehicle.warehouseId === warehouse.id,
                );
                const isAssigned = assignedVehicles.length > 0;

                return (
                  <div key={warehouse.id} className="rounded-xl border p-3">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => focusWarehouse(warehouse)}
                        aria-label={`Locate ${warehouse.name} on map`}
                        className={`flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left transition hover:bg-muted/50 ${focusedWarehouseId === warehouse.id ? "text-primary" : ""}`}
                      >
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${focusedWarehouseId === warehouse.id ? "bg-primary/10" : "bg-muted"}`}
                        >
                          <Warehouse
                            className={`size-4 ${focusedWarehouseId === warehouse.id ? "text-primary" : "text-muted-foreground"}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">
                            {warehouse.name}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {warehouse.address}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {assignedVehicles.length} vehicle
                            {assignedVehicles.length === 1 ? "" : "s"} assigned
                            · {warehouse.id}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditingWarehouse(warehouse)}
                        aria-label={`Edit ${warehouse.name}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWarehouse(warehouse)}
                        disabled={isAssigned || warehouses.length <= 1}
                        title={
                          isAssigned
                            ? "Reassign vehicles before deleting this warehouse"
                            : warehouses.length <= 1
                              ? "Keep at least one warehouse"
                              : "Delete warehouse"
                        }
                        aria-label={`Delete ${warehouse.name}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    {isAssigned && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Reassign its vehicles before deleting this warehouse.
                      </p>
                    )}
                  </div>
                );
              })}

              {warehouseFormOpen && (
                <form
                  onSubmit={handleWarehouseSubmit}
                  className="space-y-3 rounded-xl border border-primary/30 bg-muted/20 p-3"
                >
                  <p className="text-xs font-semibold">
                    {editingWarehouseId ? "Edit warehouse" : "Add warehouse"}
                  </p>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Name
                    </span>
                    <input
                      required
                      value={warehouseForm.name}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setWarehouseForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g. North Warehouse"
                      className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Address
                    </span>
                    <input
                      required
                      value={warehouseForm.address}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setWarehouseForm((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      placeholder="City, province"
                      className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Longitude
                      </span>
                      <input
                        required
                        inputMode="decimal"
                        value={warehouseForm.longitude}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setWarehouseForm((current) => ({
                            ...current,
                            longitude: event.target.value,
                          }))
                        }
                        placeholder="121.0437"
                        className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Latitude
                      </span>
                      <input
                        required
                        inputMode="decimal"
                        value={warehouseForm.latitude}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setWarehouseForm((current) => ({
                            ...current,
                            latitude: event.target.value,
                          }))
                        }
                        placeholder="14.676"
                        className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                  </div>
                  {warehouseError && (
                    <p role="alert" className="text-[11px] text-destructive">
                      {warehouseError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetWarehouseForm}
                      className="h-9 flex-1 rounded-lg border px-3 text-xs font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Save className="size-3.5" />
                      {editingWarehouseId ? "Save" : "Create"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>

        <div className="space-y-3 border-t p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Auto-dispatch next trip</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Start the next scheduled trip as soon as a vehicle is back at
                its warehouse.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoDispatch}
              aria-label="Auto-dispatch next trip"
              onClick={() => setAutoDispatch((on) => !on)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                autoDispatch ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-background shadow transition-transform ${
                  autoDispatch ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`size-2 rounded-full ${
                isRunning ? "animate-pulse bg-green-500" : "bg-amber-500"
              }`}
            />
            {isRunning ? "Simulation running" : "Simulation paused"}
            <span className="ml-auto">1 sec / tick</span>
          </p>
        </div>
      </aside>

      {/* MAP */}
      <main className="relative min-h-[500px] flex-1">
        <Map
          ref={mapRef}
          center={[121.035, 14.603]}
          zoom={11}
          className="h-full min-h-[500px] w-full"
        >
          <MapControls position="top-right" />

          {/* ROUTES: each delivery segment reflects its destination stop status. */}
          {vehicles
            .flatMap((vehicle) => {
              const route = getRoute(vehicle, warehouses);
              const selected = vehicle.id === selectedId;
              const stopSegments = vehicle.stops.map((stop, index) => ({
                key: `route-${vehicle.id}-${stop.id}`,
                coordinates: [
                  route[index]!,
                  route[index + 1]!,
                ] as Coordinates[],
                color: stop.status === "completed" ? vehicle.color : "#94a3b8",
              }));

              // The final segment is the return leg. Keep it gray until the vehicle
              // has completed the route and returned to its assigned warehouse.
              const returnStart = route[route.length - 2];
              const returnEnd = route[route.length - 1];
              const returnSegment =
                returnStart && returnEnd
                  ? [
                      {
                        key: `route-${vehicle.id}-return`,
                        coordinates: [returnStart, returnEnd] as Coordinates[],
                        color: isRouteComplete(vehicle)
                          ? vehicle.color
                          : "#94a3b8",
                      },
                    ]
                  : [];

              return [...stopSegments, ...returnSegment].map((segment) => ({
                ...segment,
                selected,
              }));
            })
            .map((segment) => (
              <MapRoute
                key={segment.key}
                coordinates={segment.coordinates}
                color={segment.color}
                width={segment.selected ? 5 : 3}
                opacity={segment.selected ? 0.9 : 0.5}
              />
            ))}

          {/* WAREHOUSES */}
          {warehouses.map((warehouse) => (
            <MapMarker
              key={warehouse.id}
              longitude={warehouse.coordinates[0]}
              latitude={warehouse.coordinates[1]}
              onClick={() => focusWarehouse(warehouse)}
            >
              <MarkerContent>
                <div
                  className={`flex size-10 items-center justify-center rounded-xl border-2 border-white text-white shadow-lg transition-transform ${focusedWarehouseId === warehouse.id ? "scale-110 ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{
                    backgroundColor:
                      focusedWarehouseId === warehouse.id
                        ? "hsl(var(--primary))"
                        : "#0f172a",
                  }}
                  aria-label={warehouse.name}
                >
                  <Warehouse className="size-5" />
                </div>
              </MarkerContent>

              <MarkerTooltip>
                <div>
                  <p className="font-semibold">{warehouse.name}</p>
                  <p className="text-xs">{warehouse.address}</p>
                </div>
              </MarkerTooltip>

              <MarkerPopup>
                <div className="min-w-40 space-y-1 p-1">
                  <div className="flex items-center gap-2">
                    <Warehouse className="size-4" />
                    <p className="font-semibold">{warehouse.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {warehouse.address}
                  </p>
                  <p className="text-xs">{warehouse.id}</p>
                </div>
              </MarkerPopup>
            </MapMarker>
          ))}

          {/* DELIVERY STOPS */}
          {vehicles.flatMap((vehicle) =>
            vehicle.stops.map((stop, index) => (
              <MapMarker
                key={`${vehicle.id}-${stop.id}`}
                longitude={stop.coordinates[0]}
                latitude={stop.coordinates[1]}
                onClick={() => {
                  selectVehicle(vehicle);
                  setDetailsOpen(true);
                }}
              >
                <MarkerContent>
                  <div
                    className={`flex size-7 items-center justify-center rounded-full border-2 border-white shadow-md ${
                      stop.status === "completed"
                        ? "bg-green-600 text-white"
                        : "bg-amber-400 text-slate-950"
                    }`}
                  >
                    {stop.status === "completed" ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <span className="text-[10px] font-bold">{index + 1}</span>
                    )}
                  </div>
                </MarkerContent>

                <MarkerTooltip>
                  <div className="space-y-1">
                    <p className="font-semibold">{stop.name}</p>
                    <p className="text-xs">{vehicle.id}</p>
                    <p className="text-xs">
                      {stop.status === "completed" ? "Completed" : "Pending"}
                    </p>
                  </div>
                </MarkerTooltip>

                <MarkerPopup>
                  <div className="min-w-40 space-y-2 p-1">
                    <p className="font-semibold">{stop.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {stop.address}
                    </p>
                    <p className="text-xs">Vehicle: {vehicle.id}</p>
                    <div className="rounded-lg bg-muted/60 p-2">
                      <p className="text-xs font-semibold">
                        Order {stop.order.id}
                      </p>
                      <p className="text-xs">{stop.order.customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getPaymentArrangementLabel(
                          stop.order.paymentArrangement,
                        )}{" "}
                        · {formatCurrency(stop.order.totalAmount)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                        stop.status === "completed"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-amber-500/10 text-amber-700"
                      }`}
                    >
                      {stop.status === "completed" ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <Clock3 className="size-3" />
                      )}
                      {stop.status === "completed" ? "Completed" : "Pending"}
                    </span>
                  </div>
                </MarkerPopup>
              </MapMarker>
            )),
          )}

          {/* TRIP PREVIEW: dashed route + numbered stops of the expanded trip */}
          {previewedTrip && (
            <>
              <MapRoute
                coordinates={[
                  selectedWarehouse.coordinates,
                  ...previewedTrip.stops.map((stop) => stop.coordinates),
                  selectedWarehouse.coordinates,
                ]}
                color={selectedVehicle.color}
                width={4}
                opacity={0.9}
                dashArray={[2, 2]}
              />
              {previewedTrip.stops.map((stop, index) => (
                <MapMarker
                  key={`preview-${previewedTrip.id}-${stop.id}`}
                  longitude={stop.coordinates[0]}
                  latitude={stop.coordinates[1]}
                >
                  <MarkerContent>
                    <div
                      className="flex size-7 items-center justify-center rounded-full border-2 border-dashed bg-background text-[10px] font-bold shadow-md"
                      style={{
                        borderColor: selectedVehicle.color,
                        color: selectedVehicle.color,
                      }}
                    >
                      {index + 1}
                    </div>
                  </MarkerContent>

                  <MarkerTooltip>
                    <div className="space-y-1">
                      <p className="font-semibold">{stop.name}</p>
                      <p className="text-xs">
                        {previewedTrip.label} · {selectedVehicle.id}
                      </p>
                      <p className="text-xs">
                        {formatSchedule(previewedTrip.scheduledAt)}
                      </p>
                    </div>
                  </MarkerTooltip>
                </MapMarker>
              ))}
            </>
          )}

          {/* VEHICLES */}
          {vehicles.map((vehicle) => {
            const [longitude, latitude] = getPosition(vehicle, warehouses);
            const selected = vehicle.id === selectedId;

            return (
              <MapMarker
                key={`vehicle-${vehicle.id}`}
                longitude={longitude}
                latitude={latitude}
                onClick={() => {
                  selectVehicle(vehicle);
                  setDetailsOpen(true);
                }}
              >
                <MarkerContent>
                  <div
                    className={`relative flex size-10 items-center justify-center rounded-xl border-2 border-white text-white shadow-lg ${
                      selected ? "scale-110" : ""
                    }`}
                    style={{ backgroundColor: vehicle.color }}
                  >
                    {vehicle.status === "returning" ? (
                      <Warehouse className="size-5" />
                    ) : (
                      <Truck className="size-5" />
                    )}
                    {vehicle.status !== "available" && (
                      <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-green-400" />
                    )}
                  </div>
                </MarkerContent>

                <MarkerTooltip>
                  <div className="space-y-1">
                    <p className="font-semibold">{vehicle.id}</p>
                    <p className="text-xs">{vehicle.driver}</p>
                    <p className="text-xs">
                      {vehicle.status === "returning"
                        ? "Returning to warehouse"
                        : vehicle.status === "available"
                          ? "Available at warehouse"
                          : "Delivering orders"}
                    </p>
                  </div>
                </MarkerTooltip>

                <MarkerPopup>
                  <div className="min-w-44 space-y-2 p-1">
                    <div className="flex items-center gap-2">
                      <Truck
                        className="size-5"
                        style={{ color: vehicle.color }}
                      />
                      <p className="font-semibold">{vehicle.id}</p>
                    </div>
                    <p className="text-xs">{vehicle.driver}</p>
                    <p className="text-xs text-muted-foreground">
                      {getWarehouse(vehicle, warehouses)?.name ??
                        "No warehouse assigned"}
                    </p>
                    <p className="text-xs">
                      {vehicle.completedStops}/{vehicle.stops.length} stops
                      completed
                    </p>
                    <p className="text-xs font-medium">
                      {vehicle.status === "returning"
                        ? "Returning to warehouse"
                        : vehicle.status === "available"
                          ? "Available"
                          : `Next: ${getNextDestination(vehicle, warehouses)?.name ?? "No destination"}`}
                    </p>
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}
        </Map>

        {/* MAP HEADER */}
        <div className="absolute left-4 right-16 top-4 z-20 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-start gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={
                sidebarOpen ? "Hide vehicle sidebar" : "Show vehicle sidebar"
              }
              aria-expanded={sidebarOpen}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background/95 shadow-sm backdrop-blur transition hover:bg-muted"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeft className="size-4" />
              )}
            </button>

            {previewedTrip && (
              <div className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border bg-background/95 py-1.5 pl-3 pr-1.5 shadow-sm backdrop-blur">
                <CalendarClock
                  className="size-4 shrink-0"
                  style={{ color: selectedVehicle.color }}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">
                    Previewing {previewedTrip.label}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {selectedVehicle.id} ·{" "}
                    {formatSchedule(previewedTrip.scheduledAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewTripId(null)}
                  aria-label="Clear trip preview"
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
            <p className="flex items-center gap-2 text-xs font-medium">
              <span
                className={`size-2 rounded-full ${
                  isRunning ? "animate-pulse bg-green-500" : "bg-amber-500"
                }`}
              />
              {activeCount} active
            </p>
            <div className="hidden items-center gap-3 border-l pl-3 text-[11px] text-muted-foreground sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber-400" />
                Pending
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-green-600" />
                Done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border border-dashed border-foreground" />
                Scheduled
              </span>
            </div>
          </div>
        </div>

        {/* SELECTED VEHICLE PANEL */}
        <div className="absolute bottom-4 left-4 z-20 w-[calc(100%-2rem)] max-w-sm">
          {/* Trigger */}
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            className="flex w-full items-center gap-3 rounded-2xl border bg-background/95 p-3 text-left shadow-lg backdrop-blur transition hover:bg-muted/95"
          >
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: `${selectedVehicle.color}18`,
                color: selectedVehicle.color,
              }}
            >
              {selectedVehicle.status === "returning" ? (
                <Warehouse className="size-5" />
              ) : (
                <Truck className="size-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {selectedVehicle.id}
                </span>
                <StatusBadge status={selectedVehicle.status} />
              </div>

              <p className="mt-1 truncate text-xs text-muted-foreground">
                {selectedVehicle.trip.label} · {selectedVehicle.completedStops}/
                {selectedVehicle.stops.length} stops · {selectedVehicle.driver}
              </p>

              {selectedVehicle.scheduledTrips.length > 0 && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="size-3" />
                  {pluralize(
                    selectedVehicle.scheduledTrips.length,
                    "more trip",
                  )}{" "}
                  scheduled
                </p>
              )}
            </div>

            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                detailsOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Panel */}
          {detailsOpen && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 flex max-h-[min(65vh,560px)] flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
              {/* Header + tabs */}
              <div className="shrink-0 space-y-3 border-b p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">Vehicle details</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {selectedVehicle.driver} · {selectedVehicle.plate}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDetailsOpen(false)}
                    aria-label="Close vehicle details"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <SegmentedTabs<DetailsTab>
                  label="Trips"
                  value={detailsTab}
                  onChange={changeDetailsTab}
                  tabs={[
                    { value: "current", label: "Current" },
                    {
                      value: "scheduled",
                      label: "Scheduled",
                      count: selectedVehicle.scheduledTrips.length,
                    },
                  ]}
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* CURRENT TRIP */}
                {detailsTab === "current" && (
                  <div className="space-y-3 p-4">
                    {selectedVehicle.status === "available" &&
                      nextScheduledTrip && (
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                          <p className="text-xs font-semibold">
                            Ready for the next trip
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {nextScheduledTrip.label} ·{" "}
                            {formatSchedule(nextScheduledTrip.scheduledAt)} ·{" "}
                            {pluralize(nextScheduledTrip.stops.length, "stop")}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => dispatchTrip(selectedVehicle.id)}
                              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                            >
                              <Send className="size-3.5" />
                              Dispatch now
                            </button>
                            <button
                              type="button"
                              onClick={() => changeDetailsTab("scheduled")}
                              className="h-9 flex-1 rounded-lg border px-3 text-xs font-medium hover:bg-muted"
                            >
                              View schedule
                            </button>
                          </div>
                        </div>
                      )}

                    {/* Trip summary */}
                    <div className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">
                            {selectedVehicle.status === "available"
                              ? "Last trip"
                              : "Current trip"}
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold">
                            {selectedVehicle.trip.label}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatSchedule(selectedVehicle.trip.scheduledAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-semibold tabular-nums">
                            {getProgressPercent(selectedVehicle)}%
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {selectedVehicle.completedStops}/
                            {selectedVehicle.stops.length} stops
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <ProgressBar
                          percent={getProgressPercent(selectedVehicle)}
                          color={selectedVehicle.color}
                        />
                      </div>

                      {selectedVehicle.scheduledTrips.length > 0 && (
                        <button
                          type="button"
                          onClick={() => changeDetailsTab("scheduled")}
                          className="mt-3 flex w-full items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs font-medium transition hover:bg-muted"
                        >
                          <span className="flex items-center gap-2">
                            <CalendarClock className="size-3.5" />
                            {pluralize(
                              selectedVehicle.scheduledTrips.length,
                              "upcoming trip",
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            View schedule
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/60 p-3">
                        <p className="text-xs text-muted-foreground">Speed</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {selectedVehicle.speed}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            km/h
                          </span>
                        </p>
                      </div>

                      <div className="rounded-xl bg-muted/60 p-3">
                        <p className="text-xs text-muted-foreground">
                          Stops remaining
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {selectedVehicle.stops.length -
                            selectedVehicle.completedStops}
                        </p>
                      </div>
                    </div>

                    {/* Assigned warehouse */}
                    <div className="rounded-xl border p-3">
                      <label
                        htmlFor="vehicle-warehouse"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Assigned warehouse
                      </label>
                      <select
                        id="vehicle-warehouse"
                        value={selectedVehicle.warehouseId}
                        disabled={selectedVehicle.status !== "available"}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          assignWarehouse(
                            selectedVehicle.id,
                            event.target.value,
                          )
                        }
                        className="mt-2 h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {selectedVehicle.status === "available"
                          ? "Choose the warehouse for this vehicle's next trip."
                          : "Warehouse assignment is locked while the vehicle is delivering or returning."}
                      </p>
                    </div>

                    {/* Destination */}
                    <div className="rounded-xl border p-3">
                      <p className="text-xs text-muted-foreground">
                        {selectedVehicle.status === "returning"
                          ? "Returning to warehouse"
                          : selectedVehicle.status === "available"
                            ? "Current location"
                            : "Next destination"}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        {selectedVehicle.status === "returning" ||
                        selectedVehicle.status === "available" ? (
                          <Warehouse className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <MapPin className="size-4 shrink-0 text-muted-foreground" />
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {nextDestination?.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {nextDestination?.address}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stops */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">Delivery stops</p>
                        <span className="text-xs text-muted-foreground">
                          {selectedVehicle.stops.length -
                            selectedVehicle.completedStops}{" "}
                          remaining
                        </span>
                      </div>

                      <div className="space-y-2">
                        {renderStops(selectedVehicle.stops)}

                        {/* Return-to-warehouse status */}
                        <div className="flex items-center gap-3 rounded-xl border border-dashed p-3">
                          <Warehouse className="size-5 shrink-0 text-muted-foreground" />

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              Return to {selectedWarehouse.name}
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {selectedWarehouse.address}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${
                              selectedVehicle.status === "available"
                                ? "bg-green-500/10 text-green-600"
                                : selectedVehicle.status === "returning"
                                  ? "bg-amber-500/10 text-amber-600"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {selectedVehicle.status === "available"
                              ? "Arrived"
                              : selectedVehicle.status === "returning"
                                ? "Returning"
                                : "Waiting"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SCHEDULED TRIPS */}
                {detailsTab === "scheduled" && (
                  <div className="space-y-3 p-4">
                    {selectedVehicle.scheduledTrips.length === 0 ? (
                      <EmptyState
                        icon={<CalendarClock className="size-5" />}
                        title="Nothing scheduled"
                        description={`${selectedVehicle.id} has no upcoming trips.`}
                      />
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {selectedVehicle.status === "available"
                            ? "This vehicle is at its warehouse. Dispatch a trip when you're ready."
                            : "Open a trip to preview its route on the map. Trips can be dispatched once the vehicle is back at its warehouse."}
                        </p>

                        {selectedVehicle.scheduledTrips.map((trip, index) => (
                          <TripCard
                            key={trip.id}
                            trip={trip}
                            color={selectedVehicle.color}
                            expanded={previewTripId === trip.id}
                            onToggle={() =>
                              togglePreview(selectedVehicle, trip)
                            }
                            tag={
                              index === 0 ? (
                                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                  Next
                                </span>
                              ) : undefined
                            }
                            footer={
                              <button
                                type="button"
                                disabled={
                                  selectedVehicle.status !== "available"
                                }
                                onClick={() =>
                                  dispatchTrip(selectedVehicle.id, trip.id)
                                }
                                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Send className="size-3.5" />
                                {selectedVehicle.status === "available"
                                  ? "Dispatch this trip now"
                                  : "Available after the current trip"}
                              </button>
                            }
                          >
                            {renderStops(trip.stops)}
                          </TripCard>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Coordinates and simulation state */}
              <div className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Activity className="size-3.5" />
                  {isRunning ? "Live simulation" : "Simulation paused"}
                </span>

                <span className="tabular-nums">
                  {selectedPosition[1].toFixed(5)},{" "}
                  {selectedPosition[0].toFixed(5)}
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
