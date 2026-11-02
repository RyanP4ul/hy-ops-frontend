import { expect, test, type APIRequestContext } from "@playwright/test";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import type { EventEmitter } from "node:events";
import { json, order, password } from "./helpers";

test.setTimeout(60_000);
const base = "http://127.0.0.1:3100";
type Message = { type: string; payload?: Record<string, unknown> };
type Socket = EventEmitter & { send(data: string): void; close(): void; terminate(): void };
const SocketClient = createRequire(process.cwd() + "/package.json")("next/dist/compiled/ws") as new (url: string, options: { headers: Record<string, string> }) => Socket;

function signed(claims: Record<string, unknown>, secret = "local-fixture-access-key-never-for-deployment") {
  const fixture = new URL(process.env.HYOPS_TEST_DATABASE_URL!);
  if (fixture.hostname !== "127.0.0.1" || fixture.pathname !== "/hyops_test") throw new Error("Fixture signing only.");
  const data = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify(claims)).toString("base64url")].join(".");
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}
function claims(token: string): Record<string, unknown> { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()); }
async function login(api: APIRequestContext, email = "admin@example.test") {
  const response = await api.post("/api/auth/login", { data: { email, password, is_mobile: email.startsWith("driver") } });
  expect(response.status()).toBe(200);
  return response.json() as Promise<{ access_token: string; refresh_token: string }>;
}
function cookie(tokens: { access_token: string; refresh_token?: string }) { return `access_token=${tokens.access_token}${tokens.refresh_token ? `; refresh_token=${tokens.refresh_token}` : ""}`; }
class Probe {
  messages: Message[] = [];
  closed = 0;
  socket: Socket;
  constructor(auth: string, port = 5180, origin: string | null = base) {
    this.socket = new SocketClient(`ws://127.0.0.1:${port}/ws`, { headers: { Cookie: auth, ...(origin ? { Origin: origin } : {}) } });
    this.socket.on("message", data => this.messages.push(JSON.parse(String(data))));
    this.socket.on("close", code => { this.closed = Number(code); });
    this.socket.on("error", () => {});
  }
  async ready() { await expect.poll(() => this.messages.some(m => m.type === "WS_READY"), { timeout: 10_000 }).toBe(true); return this; }
  async command(type: string, payload: unknown, expected: string) {
    const start = this.messages.length;
    this.socket.send(JSON.stringify({ type, payload }));
    await expect.poll(() => this.messages.slice(start).find(m => m.type === expected), { timeout: 7000 }).toBeTruthy();
    return this.messages.slice(start).find(m => m.type === expected)!;
  }
  close() { this.socket.close(); }
}
async function deniedUpgrade(auth: string, origin = base) {
  return new Promise<number>((resolve, reject) => {
    const socket = new SocketClient("ws://127.0.0.1:5180/ws", { headers: { Cookie: auth, Origin: origin } });
    const timer = setTimeout(() => { socket.terminate(); reject(new Error("Upgrade did not finish")); }, 7000);
    socket.on("unexpected-response", (_request, response: { statusCode: number; resume(): void }) => { clearTimeout(timer); response.resume(); socket.terminate(); resolve(response.statusCode); });
    socket.on("open", () => { clearTimeout(timer); socket.close(); resolve(101); });
    socket.on("error", () => {});
  });
}

test("RT-06 upgrades reject anonymous, forged, expired, wrong-purpose, stale-role and untrusted-origin credentials", async ({ request }) => {
  const tokens = await login(request), valid = claims(tokens.access_token);
  for (const auth of ["", "access_token=invalid", cookie({ access_token: signed({ ...valid, exp: 1 }) }), cookie({ access_token: signed({ ...valid, token_version: -1 }) }), cookie({ access_token: signed({ ...valid, role: "staff" }) }), cookie({ access_token: signed({ ...valid, token_type: "refresh" }) }), cookie({ access_token: signed({ ...valid, sub: "999999999" }) }), cookie({ access_token: signed({ ...valid, exp: undefined }) }), cookie({ access_token: tokens.refresh_token }), cookie({ access_token: signed(valid, "wrong-fixture-key") })]) {
    expect(await deniedUpgrade(auth)).toBe(401);
  }
  expect(await deniedUpgrade(cookie(tokens), "https://untrusted.invalid")).toBe(403);
  expect(await deniedUpgrade(cookie(tokens), "null")).toBe(403);
  expect((await request.post("/api/products", { headers: { Origin: "https://untrusted.invalid" }, data: { name: "RT06 denied origin", variants: [], version: 0 } })).status()).toBe(403);
  const probe = await new Probe(cookie(tokens)).ready(); probe.close();
  const native = await new Probe(cookie(tokens), 5180, null).ready(); native.close();
});

test("RT-06 role subscription matrix acknowledges allowed topics and rejects protected, global and malformed topics", async ({ playwright }) => {
  const staffTopics = ["dashboard", "products", "inventory", "warehouses", "orders", "deliveries", "fleet-map", "vehicles", "communications", "analysis-reports", "delivery-expenses", "delivery-schedules"];
  const adminTopics = ["users", "customers", "drivers", "payments", "calendar", "sessions-and-logs", "audit-logs", "archives", "settings", "automations"];
  for (const role of ["admin", "staff", "driver", "customer"]) {
    const api = await playwright.request.newContext({ baseURL: base });
    let probe: Probe | undefined;
    try {
      probe = await new Probe(cookie(await login(api, `${role}@example.test`))).ready();
      for (const topic of [...staffTopics, ...adminTopics, "global", "arbitrary-channel"]) {
        const allowed = role === "admin" ? [...staffTopics, ...adminTopics].includes(topic) : role === "staff" && staffTopics.includes(topic);
        const result = await probe.command("CHANGE_PAGE", [topic], allowed ? "WS_SUBSCRIBED" : "WS_ERROR");
        if (allowed) expect(result.payload?.topic).toBe(topic);
      }
      for (const payload of [[], ["products", "users"], [null], "users"]) await probe.command("CHANGE_PAGE", payload, "WS_ERROR");
      expect(probe.closed).toBe(0);
    } finally { probe?.close(); await api.dispose(); }
  }
});

test("RT-06 client mutation messages cannot forge broadcasts, records or administrative access", async ({ request, playwright }) => {
  const admin = await new Probe(cookie(await login(request))).ready();
  const api = await playwright.request.newContext({ baseURL: base });
  let staff: Probe | undefined;
  try {
    staff = await new Probe(cookie(await login(api, "staff@example.test"))).ready();
    await staff.command("CHANGE_PAGE", ["products"], "WS_SUBSCRIBED");
    for (const type of ["USER_UPDATED", "PAYMENT_UPDATED", "DELIVERY_SCHEDULE_CREATED", "RESOURCE_CHANGED", "CREATE_NOTIFICATION", "PRODUCT_HACK"]) await staff.command(type, [{ name: "RT06 forged" }], "WS_ERROR");
    await admin.command("DRIVER_LOCATION_UPDATE", [], "WS_ERROR");
    const before = admin.messages.length;
    staff.socket.send(JSON.stringify({ type: "PRODUCT_UPDATED", payload: [{ id: 1, name: "RT06 forged" }] }));
    await staff.command("CHANGE_PAGE", ["products"], "WS_SUBSCRIBED");
    expect(JSON.stringify(await json(request, "GET", "/products?search=RT06%20forged"))).not.toContain("RT06 forged");
    expect(admin.messages.slice(before).some(m => m.type === "PRODUCT_UPDATED")).toBe(false);
    await admin.command("CHANGE_PAGE", ["sessions-and-logs"], "WS_SUBSCRIBED");
    await staff.command("CHANGE_PAGE", ["orders"], "WS_SUBSCRIBED");
    await expect.poll(() => admin.messages.some(m => m.type === "CHANGE_PAGE" && m.payload?.page === "orders")).toBe(true);
    expect(staff.messages.some(m => ["NEW_SESSION", "WS_LOG_CREATED", "CHANGE_PAGE"].includes(m.type))).toBe(false);
    for (const path of ["/users", "/payments", "/sessions", "/audit-logs", "/archives", "/calendar/events"]) expect((await api.get(`/api${path}`)).status()).toBe(403);
    expect((await api.get("/api/products")).status()).toBe(200);
  } finally { admin.close(); staff?.close(); await api.dispose(); }
});

test("RT-06 drivers may send fixes only for their assigned active trip", async ({ request, playwright }) => {
  await login(request);
  const other = await json(request, "POST", "/users", { name: "RT06 other driver", email: "rt06-driver@example.test", password, role: "driver", profile: { warehouse_id: 1, status: "available", warehouse_name: "Live warehouse", phone_number: "09000000000" } });
  const created = await json(request, "POST", "/orders", order);
  await json(request, "POST", `/orders/process/${created.id}?version=1`); await json(request, "POST", `/orders/delivery/${created.id}?version=2`);
  const delivery = await json(request, "POST", "/deliveries", { order_ids: [created.id], scheduled_date: "2099-01-10", scheduled_time: "11:31", delivery_type: "INTERNAL", driver_id: 5, vehicle_id: 1, delivery_allowance: 0, fuel: 0, toll: 0 });
  const api = await playwright.request.newContext({ baseURL: base }), peer = await playwright.request.newContext({ baseURL: base });
  let driver: Probe | undefined, stranger: Probe | undefined, observer: Probe | undefined;
  try {
    driver = await new Probe(cookie(await login(api, "driver@example.test"))).ready();
    stranger = await new Probe(cookie(await login(peer, "rt06-driver@example.test"))).ready();
    observer = await new Probe(cookie(await login(request))).ready();
    await observer.command("CHANGE_PAGE", ["dashboard"], "WS_SUBSCRIBED");
    const fix = () => [String(delivery.id), 14.6, 121.2, 5, 0, 90, new Date().toISOString()];
    await driver.command("DRIVER_LOCATION_UPDATE", fix(), "WS_ERROR"); // Not dispatched.
    await json(request, "POST", `/deliveries/${delivery.id}/dispatch`);
    await stranger.command("DRIVER_LOCATION_UPDATE", fix(), "WS_ERROR");
    expect((await json(request, "GET", "/fleet/positions")).positions).toHaveLength(0);
    driver.socket.send(JSON.stringify({ type: "DRIVER_LOCATION_UPDATE", payload: fix() }));
    await expect.poll(async () => (await json(request, "GET", "/fleet/positions")).positions.length).toBe(1);
    await expect.poll(() => observer?.messages.map(m => m.type)).toContain("DRIVER_LOCATION_UPDATE");
    const recorded = (await json(request, "GET", "/fleet/positions")).positions[0].recordedAt;
    const fleet = await json(request, "GET", "/fleet"); for (const stop of fleet.vehicles[0].stops) await json(request, "POST", `/deliveries/stops/${stop.id}/delivered`); await json(request, "POST", `/deliveries/${delivery.id}/complete`);
    await driver.command("DRIVER_LOCATION_UPDATE", fix(), "WS_ERROR");
    expect((await json(request, "GET", "/fleet/positions")).positions[0].recordedAt).toBe(recorded);
    expect(other.id).toBeGreaterThan(5);
  } finally { driver?.close(); stranger?.close(); observer?.close(); await api.dispose(); await peer.dispose(); }
});

for (const action of ["password", "role", "deactivate", "logout"]) {
  test(`RT-06 ${action} revokes idle sockets and captured access/refresh credentials on both backend instances`, async ({ request, playwright }) => {
    await login(request);
    const email = `rt06-${action}@example.test`;
    const account = await json(request, "POST", "/users", { name: `RT06 ${action}`, email, password, role: "staff", profile: { warehouse_id: 1 } });
    const api = await playwright.request.newContext({ baseURL: base });
    const tokens = await login(api, email), auth = cookie(tokens);
    const probes = await Promise.all([new Probe(auth, 5180).ready(), new Probe(auth, 5181).ready()]);
    try {
      if (action === "password") expect((await request.patch(`/api/users/${account.id}/password`, { data: { password: "Changed-fixture-password-2026" } })).status()).toBe(200);
      if (action === "role") await json(request, "PUT", `/users/${account.id}?version=1`, { name: `RT06 ${action}`, email, role: "admin" });
      if (action === "deactivate") await json(request, "POST", `/users/${account.id}/archive?version=1`);
      if (action === "logout") expect((await api.post("/api/auth/logout")).status()).toBe(200);
      for (const probe of probes) await expect.poll(() => probe.closed, { timeout: 12_000 }).toBe(4001);
      for (const port of [5180, 5181]) {
        for (const path of ["/auth/me", "/products"]) expect((await api.get(`http://127.0.0.1:${port}${path}`, { headers: { Cookie: auth } })).status()).toBe(401);
        expect((await api.post(`http://127.0.0.1:${port}/auth/refresh`, { headers: { Cookie: auth } })).status()).toBe(401);
      }
      expect(await deniedUpgrade(auth)).toBe(401);
    } finally { probes.forEach(p => p.close()); await api.dispose(); }
  });
}

test("RT-06 idle expiry closes with refresh code and the real browser renews and reconnects", async ({ request, browser }) => {
  await login(request);
  const email = "rt06-expiry@example.test";
  await json(request, "POST", "/users", { name: "RT06 expiry", email, password, role: "staff", profile: { warehouse_id: 1 } });
  const context = await browser.newContext();
  try {
    const tokens = await login(context.request, email), valid = claims(tokens.access_token);
    const probe = await new Probe(cookie({ access_token: signed({ ...valid, exp: Math.floor(Date.now() / 1000) + 2 }) })).ready();
    try { await expect.poll(() => probe.closed, { timeout: 7000 }).toBe(4002); } finally { probe.close(); }
    await context.addCookies([{ name: "access_token", value: signed({ ...valid, exp: Math.floor(Date.now() / 1000) + 10 }), url: base, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage();
    await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    const refreshed = page.waitForResponse(response => response.url().endsWith("/api/auth/refresh") && response.status() === 200, { timeout: 25_000 });
    await page.goto(`${base}/panel/products`);
    await expect(page.getByRole("status", { name: "Live update connection" })).toContainText("connected");
    await refreshed;
    await expect(page.getByRole("status", { name: "Live update connection" })).toContainText("connected", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/panel\/products$/);
    expect((await context.request.get("/api/auth/me")).status()).toBe(200);
    const renewed = (await context.cookies()).find(c => c.name === "access_token");
    expect(Number(claims(renewed!.value).exp)).toBeGreaterThan(Number(valid.exp) - 30);
  } finally { await context.close(); }
});

test("RT-06 expired refresh credentials return the real browser to login after access expiry", async ({ request, browser }) => {
  await login(request);
  const email = "rt06-expired-refresh@example.test";
  await json(request, "POST", "/users", { name: "RT06 expired refresh", email, password, role: "staff", profile: { warehouse_id: 1 } });
  const context = await browser.newContext();
  try {
    const tokens = await login(context.request, email);
    await context.addCookies([
      { name: "access_token", value: signed({ ...claims(tokens.access_token), exp: Math.floor(Date.now() / 1000) + 10 }), url: base, httpOnly: true, sameSite: "Lax" },
      { name: "refresh_token", value: signed({ ...claims(tokens.refresh_token), exp: 1 }, "local-fixture-refresh-key-never-for-deployment"), url: base, httpOnly: true, sameSite: "Lax" },
    ]);
    const page = await context.newPage();
    await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    const denied = page.waitForResponse(response => response.url().endsWith("/api/auth/refresh") && response.status() === 401, { timeout: 25_000 });
    await page.goto(`${base}/panel/products`);
    await expect(page.getByRole("status", { name: "Live update connection" })).toContainText("connected");
    await denied;
    await expect(page).toHaveURL(`${base}/`, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
    expect((await context.request.get("/api/products")).status()).toBe(401);
  } finally { await context.close(); }
});
