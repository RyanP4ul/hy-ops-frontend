import { expect, test } from "bun:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { affectedQueryRoots, refreshRealtimeQueries } from "../lib/realtime";

const changed = (resource: string) => ({ type: "RESOURCE_CHANGED", payload: { resource, eventId: crypto.randomUUID() } });

const pages = [
  ["Dashboard", "users", "dashboard_query"],
  ["Analysis Reports", "inventory", "reports"],
  ["Calendar", "orders", "delivery-calendar"],
  ["Calendar events", "calendar", "event_query"],
  ["Orders", "payments", "order_detail"],
  ["Products", "product_variants", "products"],
  ["Users", "users", "users"],
  ["Settings", "settings", "setting"],
  ["Audit Logs", "audit-logs", "auditLogsQuery"],
] as const;

for (const [page, resource, root] of pages) {
  test(`${page} refetches live data while keeping its query filters`, async () => {
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const key = [root, { page: 2, search: "saved filter" }];
    cache.setQueryData(key, "before");
    cache.setQueryData(["unrelated"], "unchanged");
    let calls = 0;
    const observer = new QueryObserver(cache, { queryKey: key, queryFn: async () => { calls++; return "after"; }, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await refreshRealtimeQueries(cache, changed(resource));
      expect(calls).toBe(1);
      expect(cache.getQueryData(key)).toBe("after");
      expect(cache.getQueryState(["unrelated"])?.isInvalidated).toBe(false);
    } finally { unsubscribe(); cache.clear(); }
  });
}

test("reports follow all operational data and settings dependencies", () => {
  for (const resource of ["orders", "payments", "products", "inventory", "users", "deliveries", "delivery-schedules", "vehicles", "warehouses", "archives", "lalamove", "settings"])
    expect(affectedQueryRoots(changed(resource))).toContain("reports");
});

test("reconnect reconciles missed updates on all requested pages, including inactive filters", async () => {
  const cache = new QueryClient();
  try {
    for (const [, , root] of pages) cache.setQueryData([root, "inactive"], "before disconnect");
    await refreshRealtimeQueries(cache, { type: "WS_READY" });
    for (const [, , root] of pages) expect(cache.getQueryState([root, "inactive"])?.isInvalidated).toBe(true);
  } finally { cache.clear(); }
});

test("unknown and malformed events leave caches unchanged", async () => {
  const cache = new QueryClient();
  cache.setQueryData(["reports"], "unchanged");
  try {
    for (const message of [changed("unknown"), changed("__proto__"), changed("constructor"), { type: "RESOURCE_CHANGED", payload: null }, { type: "RESOURCE_CHANGED", payload: { resource: 1 } }])
      await refreshRealtimeQueries(cache, message);
    expect(cache.getQueryState(["reports"])?.isInvalidated).toBe(false);
  } finally { cache.clear(); }
});
