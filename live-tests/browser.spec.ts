import { expect, test } from "@playwright/test";
import { browserLogin, connectSocket, json } from "./helpers";

test("Archive retention: Products archive, schedule deletion, restore and preserve the record", async ({ page }) => {
  await browserLogin(page);
  await page.goto('/panel/products');
  await page.getByRole('button', { name: /^Add product$/i }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Product Name', { exact: false }).fill('Browser product');
  await dialog.getByRole('button', { name: /^Add product$/i }).click();
  await expect(dialog).toHaveCount(0);
  const search = page.getByPlaceholder(/Search products/);
  await search.fill('Browser product');
  const row = page.getByRole('row').filter({ hasText: 'Browser product' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /^Edit Browser product/ }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Product Name', { exact: false })).toHaveValue('Browser product');
  await dialog.getByLabel('Product Name', { exact: false }).fill('Browser product updated');
  await dialog.getByRole('button', { name: /save/i }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText('Browser product updated');
  await row.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.goto('/panel/archives');
  const archivedRow = page.getByRole('row').filter({ hasText: 'Browser product updated' });
  await expect(archivedRow).toBeVisible();
  await archivedRow.getByRole('button', { name: 'Delete', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('30 days');
  await expect(dialog).toContainText('Estimated permanent deletion date:');
  await dialog.getByRole('button', { name: 'Schedule deletion', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(archivedRow.getByRole('button', { name: 'Deletion scheduled', exact: true })).toBeDisabled();
  const records = await json(page.request, 'GET', '/archives?limit=50');
  const record = records.find((entry: { data: { name?: string } }) => entry.data.name === 'Browser product updated');
  expect(record.delete_after - record.deletion_requested_at).toBe(30 * 24 * 60 * 60);
  await archivedRow.getByRole('button', { name: 'Restore Browser product updated', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restore record', exact: true }).click();
  await expect(archivedRow).toHaveCount(0);
  await page.goto('/panel/products');
  await page.getByPlaceholder(/Search products/).fill('Browser product updated');
  await expect(row).toBeVisible();
  await expect(row).toContainText('Inactive');
  await expect(row.getByRole('button', { name: /Delete/ })).toHaveCount(0);
  await page.goto('/panel/vehicles');
  await page.getByRole('button', { name: /^Add vehicle$/i }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Status', { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel(/Image path/i)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test("two real browsers reconcile events across backend processes and after reconnect", async ({ browser }) => {
  const first = await browser.newContext(), second = await browser.newContext();
  try {
    const a = await first.newPage(), b = await second.newPage();
    let closeCode = 0;
    await browserLogin(a); await browserLogin(b, 'other@example.test');
    await a.goto('/panel/products'); await b.goto('/panel/products');
    await b.getByPlaceholder(/Search products/).fill('Cross-instance product');
    await connectSocket(b, 5181);
    const cookies = (await first.cookies()).map(c => `${c.name}=${c.value}`).join('; ');
    const response = await first.request.post('http://127.0.0.1:5181/products', { headers: { Cookie: cookies }, data: { name: 'Cross-instance product', variants: [], version: 0 } });
    expect(response.status(), await response.text()).toBe(200);
    await expect(b.getByRole('row').filter({ hasText: 'Cross-instance product' })).toBeVisible();
    await expect.poll(() => b.evaluate(() => (window as unknown as { fixtureMessages: { type: string }[] }).fixtureMessages.some(m => m.type === 'RESOURCE_CHANGED'))).toBe(true);
    await second.setOffline(true);
    await json(first.request, 'POST', '/products', { name: 'Offline-created product', variants: [], version: 0 });
    await second.setOffline(false);
    await b.getByPlaceholder(/Search products/).fill('Offline-created product');
    await expect(b.getByRole('row').filter({ hasText: 'Offline-created product' })).toBeVisible();
    // Keep the observed socket outside the app page: its logout redirect destroys
    // that document before another backend's idle session check can close it.
    const observer = await second.newPage();
    await observer.route('http://127.0.0.1:3100/fixture-socket-observer', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Socket observer</title>' }));
    await observer.goto('http://127.0.0.1:3100/fixture-socket-observer');
    await observer.exposeFunction('fixtureSocketClosed', (code: number) => { closeCode = code; });
    await connectSocket(observer, 5181);
    await second.request.post('/api/auth/logout');
    await expect.poll(() => closeCode, { timeout: 12000 }).toBe(4001);
    await expect(b).toHaveURL(/\/$/);
  } finally { await first.close(); await second.close(); }
});

test("client-supplied records cannot spoof another browser's data", async ({ page }) => {
  await browserLogin(page);
  await connectSocket(page);
  await page.evaluate(() => (window as unknown as { fixtureSocket: WebSocket }).fixtureSocket.send(JSON.stringify({ type: 'PRODUCT_UPDATED', payload: [JSON.stringify({ id: 1, name: 'Injected fake', password: 'must-not-be-logged' })] })));
  await expect.poll(async () => (await json(page.request, 'GET', '/products/1')).name).toBe('Live product');
  const logs = await json(page.request, 'GET', '/audit-logs?limit=50');
  expect(JSON.stringify(logs)).not.toContain('must-not-be-logged');
});
