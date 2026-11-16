import type { QueryClient } from "@tanstack/react-query";

type Event = { type: string; payload?: unknown };

/** Per-connection, bounded deduplication. Unversioned updates must always pass. */
export function createEventDeduplicator(limit = 1000, ttl = 30_000) {
  const seen = new Map<string, number>();
  return (message: Event, now = Date.now()): boolean => {
    if (message.type === "WS_READY") return false;
    const payload = message.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const { eventId, id, version } = payload as Record<string, unknown>;
    const key = typeof eventId === "string" ? `${message.type}:event:${eventId}`
      : (typeof id === "string" || typeof id === "number") && typeof version === "number"
        ? `${message.type}:record:${id}:${version}` : null;
    if (!key) return false;
    for (const [cached, expires] of seen) if (expires <= now) seen.delete(cached);
    if (seen.has(key)) return true;
    seen.set(key, now + ttl);
    if (seen.size > limit) {
      const oldest = seen.keys().next().value;
      if (oldest !== undefined) seen.delete(oldest);
    }
    return false;
  };
}

// Existing query roots are intentionally retained to avoid splitting caches.
const resourceQueries: Record<string, readonly string[]> = {
  notifications: ["notification"],
  lalamove: ["lalamove", "orders", "order", "order_view", "deliveries", "deliveryScheduleQuery", "inventory", "reports"],
  users: ["walk_in_customers", "communication-recipients", "customer-order-eligibility","delivery-calendar", "users", "userDetail", "customer_query", "drivers", "delivery-assignment-drivers", "archives"],
  archives: ["products", "edit_product", "product_variants", "inventory", "edit_inventory", "inventory-available-variants", "inventory-reorder", "reports", "dashboard_query","walk_in_warehouses", "walk_in_customers", "walk_in_catalog","vehicles", "vehicle_detail", "fleet", "inventory_query", "inventory-summary", "drivers", "delivery-assignment-vehicles", "delivery-assignment-drivers", "archives", "users", "warehouses", "userDetail", "warehouse_detail"],
  products: ["archives","walk_in_catalog","order_item_detail", "inventory-reorder", "dashboard_query", "reports","inventory-available-variants", "products", "edit_product", "edit_variant", "product_variants", "inventory", "inventory-summary", "inventory_query"],
  inventory: ["archives","walk_in_catalog","inventory-available-variants", "inventory", "inventory-summary", "inventory_query", "inventory-reorder", "inventory-reconciliation", "stock-history", "edit_inventory", "order_item_detail", "dashboard_query"],
  orders: ["deliveryScheduleQuery", "orders", "order", "order_detail", "order_view", "customer_query", "customer-order-eligibility", "inventory", "inventory-summary", "inventory_query", "stock-history", "inventory-reorder", "inventory-reconciliation", "payments", "invoice", "dashboard_query", "reports", "fleet", "event_query"],
  payments: ["payments", "payment-refunds", "orders", "order_view", "invoice", "reports", "dashboard_query", "fleet"],
  deliveries: ["delivery-calendar", "customer-return-pickups", "customer-return-candidates", "deliveries", "deliveryScheduleQuery", "orders", "order", "order_view", "inventory", "inventory-summary", "inventory_query", "stock-history", "inventory-reorder", "inventory-reconciliation", "fleet", "vehicles", "drivers", "delivery-assignment-drivers", "delivery-assignment-vehicles", "event_query", "dashboard_query"],
  "delivery-schedules": ["delivery-calendar", "deliveryScheduleQuery", "availableDateQuery", "deliveries", "orders", "fleet", "event_query", "dashboard_query"],
  vehicles: ["archives", "customer-return-candidates","delivery-calendar", "vehicles", "vehicle_detail", "fleet", "delivery-assignment-vehicles", "dashboard_query"],
  warehouses: ["walk_in_warehouses", "walk_in_catalog","inventory-summary", "inventory_query", "inventory-reorder", "drivers", "vehicles", "delivery-assignment-vehicles", "delivery-assignment-drivers", "dashboard_query", "reports","delivery-calendar", "warehouses", "warehouse_detail", "fleet", "archives", "inventory", "lalamove"],
  fleet: ["fleet", "vehicles", "warehouse_detail", "dashboard_query"],
  sms: ["communications-sms"],
  calendar: ["event_query"],
  settings: ["setting", "customer-order-eligibility", "inventory", "inventory-summary", "dashboard_query"],
};

// A resource can appear on several pages. Refresh every dependent query,
// including cached filters/details, rather than just the current page's table.
const pageDependencies: Record<string, readonly string[]> = {
  dashboard: ["dashboard_query"],
  users: ["dashboard_query", "reports", "fleet", "event_query", "orders", "order_view", "order_detail", "invoice", "auditLogsQuery"],
  products: ["orders", "order_view", "order_detail", "invoice"],
  inventory: ["reports", "products", "product_variants"],
  orders: ["delivery-calendar", "product_variants"],
  payments: ["order", "order_detail", "invoice"],
  deliveries: ["reports", "order_detail", "invoice"],
  "delivery-schedules": ["reports", "order_detail"],
  vehicles: ["reports", "delivery-calendar"],
  settings: ["reports", "inventory-reorder", "deliveryScheduleQuery", "availableDateQuery"],
  calendar: ["dashboard_query"],
  "audit-logs": ["auditLogsQuery"],
  reports: ["reports"],
  automations: ["automations", "backup-schedule"],
};

export const resourceQueryRoots: Record<string, readonly string[]> = Object.fromEntries(
  [...new Set([...Object.keys(resourceQueries), ...Object.keys(pageDependencies)])].map(resource => [
    resource, [...new Set([...(resourceQueries[resource] ?? []), ...(pageDependencies[resource] ?? [])])],
  ]),
);

const resourceAliases: Record<string, string> = { product_variants: "products", customers: "users", driver: "deliveries", "analysis-reports": "reports" };

function rootsForResource(resource: string): readonly string[] {
  const canonical = Object.hasOwn(resourceAliases, resource) ? resourceAliases[resource] : resource;
  return Object.hasOwn(resourceQueryRoots, canonical) ? resourceQueryRoots[canonical] : [];
}

export function affectedQueryRoots(message: Event): readonly string[] {
  if (message.type === "RESOURCE_CHANGED" && message.payload && typeof message.payload === "object") {
    const resource = (message.payload as { resource?: unknown }).resource;
    return typeof resource === "string" ? rootsForResource(resource) : [];
  }
  if (message.type === "DRIVER_LOCATION_UPDATE") return ["fleet"];
  const prefix = message.type.split("_")[0];
  const resource = ({ USER: "users", PRODUCT: "products", INVENTORY: "inventory", ORDER: "orders", PAYMENT: "payments", DELIVERY: "deliveries", VEHICLE: "vehicles", WAREHOUSE: "warehouses", ARCHIVE: "archives", CALENDAR: "calendar", SETTING: "settings", SETTINGS: "settings", AUDIT: "audit-logs", DASHBOARD: "dashboard", REPORT: "reports" } as Record<string, string>)[prefix];
  return resource ? rootsForResource(resource) : [];
}

/** Active views refetch immediately. Inactive filters refetch when opened again.
 * Reconnecting reconciles all supported pages because events are not replayed.
 */
export async function refreshRealtimeQueries(client: QueryClient, message: Event) {
  const roots = new Set(message.type === "WS_READY"
    ? Object.values(resourceQueryRoots).flat()
    : affectedQueryRoots(message));
  if (!roots.size) return;
  await client.invalidateQueries({ predicate: query => roots.has(String(query.queryKey[0])) });
}
