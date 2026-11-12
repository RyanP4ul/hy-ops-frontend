import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { browserLogin, json, login, order } from "./helpers";

test.use({ timezoneId: "America/Los_Angeles", actionTimeout: 15000 });
test.setTimeout(150000);
test("Delivery calendars show real runs and read-only details in Calendar and dashboard with warehouse scope", async ({ page, playwright }) => {
  await browserLogin(page);
  const date = (value: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  const day = date(Date.now()), tomorrow = date(Date.now() + 86400000);
  const created = await json(page.request, "POST", "/orders", order);
  await json(page.request, "POST", `/orders/process/${created.id}?version=1`);
  await json(page.request, "POST", `/orders/delivery/${created.id}?version=2`);
  const run = await json(page.request, "POST", "/deliveries", { order_ids: [created.id], driver_id: 5, vehicle_id: 1, scheduled_date: "2099-01-01", scheduled_time: "00:15", delivery_type: "INTERNAL", delivery_allowance: 0, fuel: 0, toll: 0 });
  const url = new URL(process.env.HYOPS_TEST_DATABASE_URL ?? "");
  expect(url.hostname).toBe("127.0.0.1"); expect(url.pathname).toBe("/hyops_test");
  const postgres = createRequire(process.cwd() + "/package.json")("../backend/node_modules/postgres") as typeof import("../../backend/node_modules/postgres");
  const sql = postgres(url.toString());
  let otherRunId = 0;
  try {
    // Fixture-only date override allows showing a departure today without dispatching goods.
    await sql`update deliveries set scheduled_date=${day},departure_time='00:15' where id=${run.id}`;
    const [warehouse] = await sql`insert into warehouses(name,street_address,city,state,zip_code,created_at,updated_at) values('Private warehouse','Other street','City','Province','0000',0,0) returning id`;
    const [driver] = await sql`insert into users(email,name,password_hash,role,created_at,updated_at) values('private-driver@example.test','Private driver','fixture','driver',0,0) returning id`;
    await sql`insert into drivers(user_id,warehouse_id,phone_number) values(${driver.id},${warehouse.id},'0900')`;
    const [vehicle] = await sql`insert into vehicles(warehouse_id,plate_number,created_at,updated_at) values(${warehouse.id},'PRIVATE-001',0,0) returning id`;
    const [otherRun] = await sql`insert into deliveries(driver_id,vehicle_id,scheduled_date,departure_time,status) values(${driver.id},${vehicle.id},${day},'00:30','completed') returning id`;
    otherRunId = otherRun.id;
  } finally { await sql.end(); }
  await json(page.request, "POST", "/calendar/event", { title: "Warehouse meeting", category: "MEETING_APPOINTMENT", date: day, start_time: "00:15", end_time: "00:45" });
  const feed = await json(page.request, "GET", "/deliveries/calendar");
  expect(feed.find((item: { id: number }) => item.id === run.id)).toMatchObject({ date: day, start_time: "00:15:00", status: "scheduled", driver: "Live Driver", vehicle: "LIVE-001", orders: [{ orderNumber: created.product_number }] });
  expect(feed.some((item: { id: number }) => item.id === otherRunId)).toBe(true);

  const staff = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3100" });
  try {
    await login(staff, "staff@example.test");
    expect((await json(staff, "GET", "/deliveries/calendar")).map((item: { id: number }) => item.id)).toEqual([run.id]);
    expect((await json(staff, "GET", "/dashboard/stats")).delivery_calendar.map((item: { id: number }) => item.id)).toEqual([run.id]);
  } finally { await staff.dispose(); }

  await page.goto("/panel/calendar");
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const deliveryButton = () => page.getByRole("button", { name: new RegExp(`View Delivery #${run.id} / LIVE-001`) });
  await expect(deliveryButton()).toContainText("Departure 12:15 AM");
  await deliveryButton().click();
  const details = page.getByRole("dialog");
  await expect(details.getByRole("heading", { name: `Delivery #${run.id}`, exact: true })).toBeVisible();
  await expect(details).toContainText("Live Driver"); await expect(details).toContainText(created.product_number);
  await expect(details).toContainText("Departure time only");
  await expect(details.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  await details.getByRole("button", { name: "Close", exact: true }).first().click();
  await page.getByRole("button", { name: /Edit Warehouse meeting/ }).click();
  await expect(details.getByLabel("Title", { exact: false })).toHaveValue("Warehouse meeting");
  await details.getByRole("button", { name: "Close", exact: true }).first().click();

  await page.goto("/panel");
  const dashboard = page.getByRole("region", { name: "Dashboard delivery calendar", exact: true });
  await dashboard.getByRole("button", { name: new RegExp(`^${day},`) }).click();
  await dashboard.getByRole("button", { name: `View delivery #${run.id}`, exact: true }).click();
  await expect(details).toContainText("12:15 AM"); await expect(details).toContainText("Scheduled");
  await details.getByRole("button", { name: "Close", exact: true }).first().click();

  await json(page.request, "POST", "/deliveries/event", { delivery_id: run.id, delivery_version: 1, event_type: "RESCHEDULED", reason: "New departure", scheduled_date: tomorrow, departure_time: "23:45" });
  const rescheduled = (await json(page.request, "GET", "/deliveries/calendar")).find((item: { id: number }) => item.id === run.id);
  expect(rescheduled).toMatchObject({ date: tomorrow, start_time: "23:45:00", version: 2 });
  await json(page.request, "POST", "/deliveries/event", { delivery_id: run.id, delivery_version: 2, event_type: "CANCELLED", reason: "Cancelled fixture" });
  await page.goto("/panel/calendar");
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(deliveryButton()).toContainText("Cancelled");
  await expect(deliveryButton()).toContainText("11:45 PM");
  expect((await json(page.request, "GET", "/calendar/events")).filter((item: { title: string }) => item.title === "Warehouse meeting")).toHaveLength(1);
});
