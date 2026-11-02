import { expect, test } from "@playwright/test";
import { json, login, order } from "./helpers";

test("real HTTP guard rejects anonymous, forbidden roles, bad origin and invalid bodies", async ({ request, playwright }) => {
  expect((await request.get('/api/products')).status()).toBe(401);
  await login(request, 'staff@example.test');
  for (const path of ['/users', '/payments', '/calendar/events', '/audit-logs']) expect((await request.get(`/api${path}`)).status(), path).toBe(403);
  expect((await request.get('/api/products')).status()).toBe(200);
  const admin = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3100' });
  try {
    await login(admin);
    expect((await admin.post('/api/products', { headers: { Origin: 'https://untrusted.invalid' }, data: { name: 'Denied', variants: [], version: 0 } })).status()).toBe(403);
    const invalid = await admin.post('/api/orders', { data: { ...order, items: [{ inventory_id: 1, quantity: -1 }] } });
    expect(invalid.status()).toBe(400);
    expect(await invalid.text()).not.toMatch(/password_hash|postgres:\/\/|stack/);
    expect((await admin.post('/api/email/send', { data: { to: 'nobody@example.test', subject: 'Blocked', message: 'Blocked' } })).status()).toBe(503);
  } finally { await admin.dispose(); }
});

test("HTTP order, payment, refund, dispatch and completion preserve exact totals and stock", async ({ request }) => {
  await login(request);
  const created = await json(request, 'POST', '/orders', order);
  const id = created.id;
  expect(id).toBeGreaterThan(0);
  await json(request, 'POST', `/orders/process/${id}?version=1`);
  await json(request, 'POST', `/orders/delivery/${id}?version=2`);
  const scheduled = await json(request, 'POST', '/deliveries', { order_ids: [id], scheduled_date: '2099-01-01', scheduled_time: '09:00', delivery_type: 'INTERNAL', driver_id: 5, vehicle_id: 1, delivery_allowance: 0, fuel: 0, toll: 0 });
  const payment = (await json(request, 'GET', '/payments?limit=50')).find((row: { order_id: number }) => row.order_id === id);
  expect(payment).toBeTruthy();
  const paid = await json(request, 'POST', '/payments', { payment_number: payment.payment_number, payment_amount: 24.68, version: payment.version });
  expect(Number(paid.amount)).toBe(24.68);
  const request_id = crypto.randomUUID();
  const refund = { payment_number: payment.payment_number, amount: 4.68, version: paid.version, reason: 'Local fixture refund', request_id };
  await json(request, 'POST', '/payments/refunds', refund);
  await json(request, 'POST', '/payments/refunds', refund);
  const history = await json(request, 'GET', `/payments/${payment.payment_number}/refunds`);
  expect(history).toHaveLength(1);
  await json(request, 'POST', `/deliveries/${scheduled.id}/dispatch`);
  const fleet = await json(request, 'GET', '/fleet');
  const trip = fleet.vehicles.find((v: { id: string }) => v.id === '1');
  expect(trip.stops.length).toBeGreaterThan(0);
  for (const stop of trip.stops) await json(request, 'POST', `/deliveries/stops/${stop.id}/delivered`);
  await json(request, 'POST', `/deliveries/${scheduled.id}/complete`);
  await json(request, 'POST', `/deliveries/${scheduled.id}/complete`);
  const inventory = await json(request, 'GET', '/inventory?limit=10');
  expect(inventory[0].quantity).toBe(9998);
  expect(inventory[0].reserved).toBe(0);
});

test("real HTTP stale updates, cancellation and history protection", async ({ request }) => {
  await login(request);
  const created = await json(request, 'POST', '/orders', order);
  await json(request, 'PUT', `/orders/${created.id}`, { version: 1, notes: 'Fixture update' });
  expect((await request.put(`/api/orders/${created.id}`, { data: { version: 1, notes: 'Stale' } })).status()).toBe(409);
  await json(request, 'POST', `/orders/cancel/${created.id}?version=2`);
  expect((await request.delete('/api/products/1?version=1')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.delete('/api/warehouses/1?version=1')).status()).toBeGreaterThanOrEqual(400);
});

test("logout revokes captured access and refresh credentials", async ({ request }) => {
  await login(request);
  const state = await request.storageState();
  const cookie = state.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  expect((await request.post('/api/auth/logout')).status()).toBe(200);
  expect((await request.get('/api/auth/me', { headers: { cookie } })).status()).toBe(401);
  expect((await request.post('/api/auth/refresh', { headers: { cookie } })).status()).toBe(401);
});
