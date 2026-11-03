import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("WebSocket tickets connect across hosts and backend instances without cookies", async ({ page, context }) => {
  // Chromium requires permission when crossing loopback hostnames in this fixture.
  await context.grantPermissions(["local-network-access"]);
  await login(context.request);
  await page.route("**/ws-ticket-observer", route => route.fulfill({
    contentType: "text/html", body: "<!doctype html><title>Socket observer</title>",
  }));
  await page.goto("/ws-ticket-observer");
  // Frontend cookies belong to 127.0.0.1. The socket uses localhost and another
  // backend instance, reproducing the separate Vercel/Render cookie hosts.
  expect(await context.cookies("http://localhost:5181")).toHaveLength(0);
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/auth/ws-ticket", { method: "POST", credentials: "include" });
    if (!response.ok) throw new Error(`Ticket request failed: ${response.status}`);
    const { ticket } = await response.json();
    const socket = new WebSocket(`ws://localhost:5181/ws?ticket=${encodeURIComponent(ticket)}`);
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error("WS_READY timeout")); }, 8000);
      socket.onmessage = event => {
        if (JSON.parse(event.data).type === "WS_READY") {
          clearTimeout(timer); socket.close(); resolve("WS_READY");
        }
      };
      socket.onerror = () => { clearTimeout(timer); socket.close(); reject(new Error("Ticket upgrade failed")); };
    });
  });
  expect(result).toBe("WS_READY");
});

test("WebSocket tickets provider obtains a fresh ticket when reconnecting", async ({ page, context }) => {
  await login(context.request);
  const readyUrls: string[] = [];
  page.on("websocket", socket => {
    socket.on("framereceived", frame => {
      if (typeof frame.payload === "string" && JSON.parse(frame.payload).type === "WS_READY") readyUrls.push(socket.url());
    });
  });
  await page.goto("/panel");
  await expect.poll(() => readyUrls.length).toBeGreaterThan(0);
  const firstTicket = new URL(readyUrls[0]).searchParams.get("ticket");
  expect(firstTicket).toBeTruthy();
  await context.setOffline(true);
  await context.setOffline(false);
  await expect.poll(() => readyUrls.length).toBeGreaterThan(1);
  expect(new URL(readyUrls.at(-1)!).searchParams.get("ticket")).not.toBe(firstTicket);
});
