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
export const resourceQueryRoots: Record<string, readonly string[]> = {
  users: ["delivery-calendar", "users", "userDetail", "customer_query", "drivers", "delivery-assignment-drivers", "archives"],
  archives: ["archives", "users", "warehouses", "userDetail", "warehouse_detail"],
  products: ["inventory-available-variants", "products", "edit_product", "edit_variant", "product_variants", "inventory", "inventory-summary", "inventory_query"],
  inventory: ["inventory-available-variants", "inventory", "inventory-summary", "inventory_query", "inventory-reorder", "inventory-reconciliation", "stock-history", "edit_inventory", "order_item_detail", "dashboard_query"],
  orders: ["deliveryScheduleQuery", "orders", "order", "order_detail", "order_view", "customer_query", "customer-order-eligibility", "inventory", "inventory-summary", "inventory_query", "stock-history", "inventory-reorder", "inventory-reconciliation", "payments", "invoice", "dashboard_query", "reports", "fleet", "event_query"],
  payments: ["payments", "payment-refunds", "orders", "order_view", "invoice", "reports", "dashboard_query", "fleet"],
  deliveries: ["delivery-calendar", "customer-return-pickups", "customer-return-candidates", "deliveries", "deliveryScheduleQuery", "orders", "order", "order_view", "inventory", "inventory-summary", "inventory_query", "stock-history", "inventory-reorder", "inventory-reconciliation", "fleet", "vehicles", "drivers", "delivery-assignment-drivers", "delivery-assignment-vehicles", "event_query", "dashboard_query"],
  "delivery-schedules": ["delivery-calendar", "deliveryScheduleQuery", "availableDateQuery", "deliveries", "orders", "fleet", "event_query", "dashboard_query"],
  vehicles: ["delivery-calendar", "vehicles", "vehicle_detail", "fleet", "delivery-assignment-vehicles", "dashboard_query"],
  warehouses: ["delivery-calendar", "warehouses", "warehouse_detail", "fleet", "archives", "inventory"],
  fleet: ["fleet", "vehicles", "warehouse_detail", "dashboard_query"],
  sms: ["communications-sms"],
  calendar: ["event_query"],
  settings: ["setting", "customer-order-eligibility", "inventory", "inventory-summary", "dashboard_query"],
};

export function affectedQueryRoots(message: Event): readonly string[] {
  if (message.type === "RESOURCE_CHANGED" && message.payload && typeof message.payload === "object") {
    const resource = (message.payload as { resource?: unknown }).resource;
    return typeof resource === "string" ? resourceQueryRoots[resource] ?? [] : [];
  }
  if (message.type === "DRIVER_LOCATION_UPDATE") return ["fleet"];
  const prefix = message.type.split("_")[0];
  const resource = ({ USER: "users", PRODUCT: "products", INVENTORY: "inventory", ORDER: "orders", PAYMENT: "payments", DELIVERY: "deliveries", VEHICLE: "vehicles", WAREHOUSE: "warehouses", ARCHIVE: "archives" } as Record<string, string>)[prefix];
  return resourceQueryRoots[resource] ?? [];
}
