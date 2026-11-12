import { expect, test } from "@playwright/test";
import { browserLogin, connectSocket, json, order, password } from "./helpers";

test.use({ timezoneId: "Asia/Manila", actionTimeout: 15_000 });
test.setTimeout(150_000);

const blankStyle = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#f8fafc" },
    },
  ],
};

test("Fleet Map 1 renders independent statuses, view modes, guarded delivery review, and live GPS updates without overflow", async ({
  page,
  browser,
}) => {
  await browserLogin(page, "admin@example.test");

  // Create an order and schedule it on LIVE-001 (vehicle 1, driver 5).
  const created = await json(page.request, "POST", "/orders", order);
  await json(page.request, "POST", `/orders/process/${created.id}?version=1`);
  await json(page.request, "POST", `/orders/delivery/${created.id}?version=2`);
  const delivery = await json(page.request, "POST", "/deliveries", {
    order_ids: [created.id],
    scheduled_date: "2099-01-10",
    scheduled_time: "09:00",
    delivery_type: "INTERNAL",
    driver_id: 5,
    vehicle_id: 1,
    delivery_allowance: 0,
    fuel: 0,
    toll: 0,
  });

  // Create a second vehicle and mark it in maintenance (at the same warehouse).
  const maintCreated = await json(page.request, "POST", "/vehicles", {
    warehouse_id: 1,
    plate_number: "MAINT-01",
    type: "van",
  });
  await json(
    page.request,
    "PUT",
    `/vehicles/${maintCreated.id}?version=1`,
    {
      warehouse_id: 1,
      plate_number: "MAINT-01",
      type: "van",
      status: "maintenance",
      version: 1,
    },
  );

  // Dispatch the trip so LIVE-001 is active and eligible for live GPS fixes.
  await json(page.request, "POST", `/deliveries/${delivery.id}/dispatch`);

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route(
    "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    (route) => route.fulfill({ json: blankStyle }),
  );
  await page.route(
    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    (route) => route.fulfill({ json: blankStyle }),
  );

  // Simulate routing outage initially to ensure no straight-line fallback lies.
  let failRoute = true;
  await page.route("**/panel/fleet-map-1/road-route?**", (route) =>
    failRoute
      ? route.fulfill({
          status: 502,
          json: { message: "Routing provider unavailable" },
        })
      : route.fulfill({
          json: {
            coordinates: [
              [121.1, 14.5],
              [121.15, 14.55],
              [121.2, 14.6],
            ],
            distance: 6200,
            duration: 540,
            legs: [
              {
                coordinates: [
                  [121.1, 14.5],
                  [121.15, 14.55],
                  [121.2, 14.6],
                ],
                distance: 6200,
                duration: 540,
              },
            ],
          },
        }),
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/panel/fleet-map-1");

  const workspace = page.getByRole("region", {
    name: "Fleet dispatch workspace",
    exact: true,
  });
  await expect(workspace).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Live update connection" }),
  ).toContainText("connected");

  // 1. Check exhaustive fleet summary counts & independent maintenance/GPS display.
  const summaryNav = page.getByRole("navigation", {
    name: "Fleet status summary",
  });
  await expect(summaryNav.getByRole("button", { name: "All: 2" })).toBeVisible();
  await expect(summaryNav.getByRole("button", { name: "On route: 1" })).toBeVisible();
  await expect(summaryNav.getByRole("button", { name: "Out of service: 1" })).toBeVisible();
  await expect(summaryNav.getByRole("button", { name: "GPS attention: 2" })).toBeVisible();

  // Filter to Out of service -> shows MAINT-01 with Maintenance + No GPS.
  await summaryNav.getByRole("button", { name: /Out of service/ }).click();
  await expect(page.getByRole("button", { name: /MAINT-01/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /LIVE-001/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByRole("button", { name: /LIVE-001/ }).first()).toBeVisible();

  // 2. Test View Modes: List Only -> Map Only -> Map & List + Fullscreen + Overflow checks.
  await page.getByRole("button", { name: "List Only", exact: true }).click();
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table).toContainText("LIVE-001");
  await expect(table).toContainText("MAINT-01");
  await expect(table).toContainText("Maintenance");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Map Only", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Quick search vehicle on map" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Map & List", exact: true }).click();

  // Fullscreen toggle + Escape exit.
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Exit fullscreen", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Fullscreen", exact: true }),
  ).toBeVisible();

  // 3. Driver GPS WebSocket test: stale fix -> fresh fix -> road route recovery.
  const driver = await browser.newContext();
  try {
    const mobileLogin = await driver.request.post(
      "http://127.0.0.1:3100/api/auth/login",
      {
        data: {
          email: "driver@example.test",
          password,
          is_mobile: true,
        },
      },
    );
    expect(mobileLogin.status()).toBe(200);
    const observer = await driver.newPage();
    await observer.goto("http://127.0.0.1:3100/");
    await connectSocket(observer);

    const freshIso = new Date().toISOString();
    const staleIso = new Date(Date.now() - 180_000).toISOString();
    const sendFix = (recordedAt: string) =>
      observer.evaluate(
        ({ id, recordedAt }) =>
          (
            window as unknown as { fixtureSocket: WebSocket }
          ).fixtureSocket.send(
            JSON.stringify({
              type: "DRIVER_LOCATION_UPDATE",
              payload: [String(id), 14.55, 121.15, 8, 5, 90, recordedAt],
            }),
          ),
        { id: delivery.id, recordedAt },
      );

    await page.bringToFront();

    // First verify stale GPS fix renders "Last known" warning clearly.
    await page.route("**/api/fleet/positions", (route) =>
      route.fulfill({
        json: {
          positions: [
            {
              vehicleId: "1",
              coordinates: [121.15, 14.55],
              speedKph: 18,
              heading: 90,
              recordedAt: staleIso,
            },
          ],
        },
      }),
    );

    await page.getByRole("button", { name: /LIVE-001/ }).first().click();

    const drawer = page.getByRole("region", {
      name: "Vehicle LIVE-001 details",
    });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(/Last known · 3m ago/, { timeout: 15_000 });
    await expect(drawer).toContainText(
      "Showing last known location (not a verified live position).",
    );

    // Road routing outage shows honest fallback notice + retry.
    await expect(
      page.getByText("Road routing unavailable (no straight-line fallback shown)."),
    ).toBeVisible();
    failRoute = false;
    await page.getByRole("button", { name: "Retry", exact: true }).first().click();
    await expect(drawer).toContainText(/Est\. drive: 9 min · 6\.2 km/);

    // Unroute mocked positions and send real fresh GPS fix via driver WebSocket.
    await page.unroute("**/api/fleet/positions");
    await sendFix(freshIso);
    await expect
      .poll(
        async () =>
          (await json(page.request, "GET", "/fleet/positions")).positions[0]
            ?.recordedAt,
      )
      .toBe(freshIso);

    await expect(drawer).toContainText(/GPS fresh/, { timeout: 15_000 });

    // Toggle Follow, Routes, and Legend controls cleanly.
    await drawer.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(page.getByText("Following LIVE-001")).toBeVisible();
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(page.getByText("Following LIVE-001")).toHaveCount(0);

    await page.getByRole("button", { name: "Legend", exact: true }).click();
    await expect(page.getByText("Map legend")).toBeVisible();
    await page.getByRole("button", { name: "Close legend", exact: true }).click();
    await expect(page.getByText("Map legend")).toHaveCount(0);

    await page.getByRole("button", { name: "Routes on", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Routes off", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Routes off", exact: true }).click();

    // Check tablet and mobile responsive overflow with drawer open.
    await page.setViewportSize({ width: 768, height: 1024 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    // Back to desktop for stop review + guarded manual completion.
    await page.setViewportSize({ width: 1440, height: 900 });
    await drawer
      .getByRole("button", { name: new RegExp(created.product_number) })
      .first()
      .click();

    // Check Proof of Delivery modal.
    await drawer.getByRole("button", { name: "View proof", exact: true }).click();
    const proofDialog = page.getByRole("dialog", {
      name: new RegExp(`Proof of delivery — ${created.product_number}`),
    });
    await expect(proofDialog).toContainText("No proof of delivery uploaded");
    await proofDialog.getByRole("button", { name: "Close", exact: true }).first().click();

    // Check Full Order Details modal.
    await drawer
      .getByRole("button", { name: "View full order details", exact: true })
      .click();
    const orderDialog = page.getByRole("dialog", {
      name: new RegExp(`Order ${created.product_number}`),
    });
    await expect(orderDialog).toContainText("Live variant");
    await orderDialog.getByRole("button", { name: "Close", exact: true }).first().click();

    // Guarded manual delivery review: requires override reason + checkbox, handles 409 error cleanly.
    await drawer
      .getByRole("button", { name: "Review delivery", exact: true })
      .click();
    const confirmDialog = page.getByRole("dialog", {
      name: "Review & confirm stop delivery",
    });
    await expect(confirmDialog).toContainText(
      "Manual override — No Proof of Delivery on file",
    );
    const confirmBtn = confirmDialog.getByRole("button", {
      name: "Confirm delivery",
      exact: true,
    });
    await expect(confirmBtn).toBeDisabled();
    await confirmDialog
      .getByLabel("Dispatcher override reason (required)")
      .fill("Verified signed paper receipt with driver by phone");
    await confirmDialog.getByRole("checkbox").check();
    await expect(confirmBtn).toBeEnabled();

    let rejectOnce = true;
    await page.route("**/api/deliveries/stops/*/delivered", (route) => {
      if (rejectOnce) {
        rejectOnce = false;
        return route.fulfill({
          status: 409,
          json: { message: "Stop state changed concurrently. Refresh and retry." },
        });
      }
      return route.continue();
    });
    await confirmBtn.click();
    await expect(confirmDialog.getByRole("alert")).toContainText(
      "Stop state changed concurrently",
    );
    await expect(confirmDialog).toBeVisible();

    await page.unroute("**/api/deliveries/stops/*/delivered");
    await confirmBtn.click();
    await expect(confirmDialog).toHaveCount(0);

    // Vehicle transitions to Returning after stop completion.
    await expect(drawer).toContainText("Returning", { timeout: 15_000 });

    // Clean up delivery so database returns cleanly.
    await json(page.request, "POST", `/deliveries/${delivery.id}/complete`);
    expect(pageErrors).toEqual([]);
  } finally {
    await driver.close();
  }
});
