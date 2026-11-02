import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const password = "Fixture-password-2026";
export async function login(api: APIRequestContext, email = "admin@example.test") {
  const response = await api.post("/api/auth/login", { data: { email, password, is_mobile: email.startsWith("driver") } });
  expect(response.status(), await response.text()).toBe(200);
}
export async function browserLogin(page: Page, email = "admin@example.test") {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto("/");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/panel/, { timeout: 30_000 });
  await expect(page.getByText(email, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}
export async function json(api: APIRequestContext, method: string, path: string, data?: unknown) {
  const response = await api.fetch(`/api${path}`, { method, data });
  expect(response.status(), `${method} ${path}: ${await response.text()}`).toBe(200);
  return response.json();
}
export const order = { warehouse_id: 1, customer_id: 1, payment_method: "CASH", payment_arrangement: "NET_30", amount_paid: 0, is_custom_shipping: false, customer_address_id: 1, items: [{ inventory_id: 1, quantity: 2 }] };

export async function connectSocket(page: Page, port = 5180) {
  await page.evaluate(async (port) => {
    const state = window as unknown as { fixtureSocket: WebSocket; fixtureMessages: { type: string; payload?: Record<string, unknown> }[]; fixtureClose: number; fixtureSocketClosed?: (code: number) => Promise<void> };
    state.fixtureMessages = []; state.fixtureClose = 0;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    state.fixtureSocket = socket;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WS_READY timeout")), 8000);
      socket.onmessage = event => { const message = JSON.parse(event.data); state.fixtureMessages.push(message); if (message.type === "WS_READY") { clearTimeout(timeout); resolve(); } };
      socket.onerror = () => { clearTimeout(timeout); reject(new Error("Fixture socket handshake failed")); };
      socket.onclose = event => { clearTimeout(timeout); reject(new Error(`Fixture socket closed (${event.code}) before WS_READY`)); state.fixtureClose = event.code; void state.fixtureSocketClosed?.(event.code); };
    });
  }, port);
}
