import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import type { AxeResults } from "axe-core";
import { browserLogin, json, login } from "./helpers";

test.use({ actionTimeout: 15_000 });
let sql: ReturnType<typeof import("../../backend/node_modules/postgres")>;
test.beforeAll(() => {
  const url = new URL(process.env.HYOPS_TEST_DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/hyops_test") throw new Error("Notifications tests require the disposable loopback fixture.");
  const postgres = createRequire(process.cwd() + "/package.json")("../backend/node_modules/postgres") as typeof import("../../backend/node_modules/postgres");
  sql = postgres(url.toString());
});
test.afterAll(async () => { await sql?.end(); });
test.beforeEach(async ({ page }) => {
  await sql`delete from notifications`;
  await browserLogin(page);
});
async function seed(type: string, userId = 1, title = "Attention needed") {
  const [row] = await sql`insert into notifications(user_id,title,message,type,created_at) values (${userId},${title},'Please review this update.',${type},${Math.floor(Date.now() / 1000)}) returning id`;
  return row.id as number;
}

for (const [type, href, action] of [
  ["LOW_STOCK", "/panel/inventory", "View inventory"],
  ["OVERDUE_PAYMENT", "/panel/payments", "View payments"],
  ["DELIVERY_FOLLOW_UP", "/panel/deliveries", "View deliveries"],
]) test(`Notifications ${type} opens the relevant page and marks only the clicked alert read`, async ({ page }) => {
  const id = await seed(type);
  await seed("info", 1, "General update");
  await page.reload(); await page.getByRole("button", { name: "Notifications", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(panel).toContainText("2 unread notifications");
  const link = panel.getByRole("link", { name: new RegExp(action) });
  await expect(link).toHaveAttribute("href", href);
  const read = page.waitForResponse(response => response.url().endsWith(`/api/notifications/${id}/read`));
  await link.focus(); await page.keyboard.press("Enter");
  expect((await read).status()).toBe(200);
  await expect(page).toHaveURL(`http://127.0.0.1:3100${href}`);
  await expect(panel).toHaveCount(0);
  const data = await json(page.request, "GET", "/notifications");
  expect(data.total_unread).toBe(1); expect(data.rows.find((row: { id: number }) => row.id === id).is_read).toBe(true);
});

test("Notifications empty state is centered and fits mobile and dark mode", async ({ page }) => {
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Notifications", exact: true });
  const empty = panel.locator('[data-slot="notifications-empty"]');
  await expect(empty).toContainText("You're all caught up");
  const offset = await empty.evaluate(element => {
    const bounds = element.getBoundingClientRect(); const first = element.firstElementChild!.getBoundingClientRect(); const last = element.lastElementChild!.getBoundingClientRect();
    return Math.abs((first.top + last.bottom) / 2 - (bounds.top + bounds.bottom) / 2);
  });
  expect(offset).toBeLessThan(2);
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 640 });
    await expect.poll(async () => { const bounds = await panel.boundingBox(); return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= 640; }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const violations = await panel.evaluate(async element => (await (window as unknown as { axe: { run: (element: Element, options: unknown) => Promise<AxeResults> } }).axe.run(element, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(row => row.id));
    expect(violations).toEqual([]);
  }
  await panel.screenshot({ path: "../../.tmp/notifications-empty-mobile.png" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(300);
  await panel.screenshot({ path: "../../.tmp/notifications-empty-dark.png" });
});

test("Notifications show loading and recover from errors without reporting an empty inbox", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let first = true;
  await page.route("**/api/notifications", async route => {
    if (first) { first = false; await held; return route.fulfill({ status: 500, json: { message: "Fixture failure" } }); }
    return route.continue();
  });
  await page.reload(); await page.getByRole("button", { name: "Notifications", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(panel.getByRole("status")).toContainText("Loading notifications");
  release(); await expect(panel.getByRole("alert")).toContainText("Unable to load notifications");
  await expect(panel.getByText("You're all caught up", { exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Retry notifications", exact: true }).click();
  await expect(panel).toContainText("You're all caught up");
});

test("Notifications mark all read once and keep unknown types as plain text", async ({ page }) => {
  await seed("LOW_STOCK"); await seed("javascript:alert(1)", 1, "General update");
  await page.reload(); await page.getByRole("button", { name: "Notifications", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(panel.getByRole("link")).toHaveCount(1);
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route("**/api/notifications/mark-all-read", async route => { requests++; await held; await route.continue(); });
  const action = panel.getByRole("button", { name: "Mark all as read", exact: true });
  await action.click(); await expect(action).toBeDisabled(); release();
  await expect(panel).toContainText("Your latest updates");
  await expect(panel.getByText("Unread", { exact: true })).toHaveCount(0);
  expect(requests).toBe(1);
  expect((await json(page.request, "GET", "/notifications")).total_unread).toBe(0);
  await json(page.request, "POST", "/notifications/mark-all-read", {});
  await panel.screenshot({ path: "../../.tmp/notifications-list.png" });
});

test("Notifications read endpoint is idempotent and scoped to the authenticated owner", async ({ page, playwright }) => {
  const own = await seed("LOW_STOCK"); const other = await seed("LOW_STOCK", 2); const driver = await seed("info", 5);
  expect((await page.request.post(`/api/notifications/${other}/read`, { data: {} })).status()).toBe(404);
  await json(page.request, "POST", `/notifications/${own}/read`, {});
  await json(page.request, "POST", `/notifications/${own}/read`, {});
  expect((await json(page.request, "GET", "/notifications")).total_unread).toBe(0);
  expect((await sql`select is_read from notifications where id=${other}`)[0].is_read).toBe(false);
  const api = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3100" });
  try {
    await login(api, "driver@example.test");
    await json(api, "POST", `/notifications/${driver}/read`, {});
    expect((await api.post(`/api/notifications/${own}/read`, { data: {} })).status()).toBe(404);
  } finally { await api.dispose(); }
});


test("Notifications payment alerts take staff to the Orders page they can access", async ({ page }) => {
  await seed("OVERDUE_PAYMENT", 3);
  await page.context().clearCookies();
  await browserLogin(page, "staff@example.test");
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Notifications", exact: true });
  const link = panel.getByRole("link", { name: /View orders/ });
  await expect(link).toHaveAttribute("href", "/panel/orders");
  await link.click(); await expect(page).toHaveURL(/\/panel\/orders$/);
});
