import { expect, test } from "@playwright/test";
import { browserLogin, login } from "./helpers";
import type { AxeResults } from "axe-core";

test("operational pages expose accessible controls and fit desktop/mobile viewports", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await browserLogin(page);
  const findings: unknown[] = [];
  for (const moduleName of ['', 'products', 'inventory', 'warehouses', 'calendar', 'orders', 'payments', 'deliveries', 'fleet-map', 'vehicles', 'users', 'analysis-reports']) {
    await page.goto(`/panel/${moduleName}`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    });
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    const result = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (options: unknown) => Promise<AxeResults> } }).axe;
      return axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    });
    findings.push({ module: moduleName, violations: result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, failureSummary: n.failureSummary })) })) });
    for (const width of [390, 768, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${moduleName} overflows ${width}px`).toBe(true);
    }
    expect.soft(result.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')).map(v => `${moduleName}: ${v.id} ${JSON.stringify(v.nodes.map(n => n.target))}`)).toEqual([]);
  }
  await testInfo.attach('accessibility-audit', { body: JSON.stringify(findings, null, 2), contentType: 'application/json' });
});

test("product dialog supports keyboard focus, escape, reduced motion and 200 percent zoom", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await browserLogin(page);
  await page.goto('/panel/products');
  await page.setViewportSize({ width: 683, height: 384 }); // 1366x768 at 200% effective CSS viewport.
  const trigger = page.getByRole('button', { name: 'Add Product', exact: true });
  await trigger.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("representative pagination, request concurrency and browser network baseline", async ({ request, page }, testInfo) => {
  await login(request);
  const measurements: Record<string, unknown> = { products: 501, environment: 'local disposable PostgreSQL, Next development server; not a production SLO' };
  for (const [label, concurrency] of [['sequential', 1], ['concurrent', 8]] as const) {
    const times: number[] = [];
    for (let batch = 0; batch < 5; batch++) await Promise.all(Array.from({ length: concurrency }, async () => {
      const start = performance.now();
      const response = await request.get('/api/products?page=0&limit=10&search=Performance');
      times.push(performance.now() - start);
      expect(response.status()).toBe(200);
      expect(await response.json()).toHaveLength(10);
      expect(response.headers()['x-total-count']).toBe('500');
    }));
    times.sort((a,b) => a-b);
    measurements[label] = { requests: times.length, medianMs: Math.round(times[Math.floor(times.length / 2)]), p95Ms: Math.round(times[Math.ceil(times.length * .95)-1]) };
  }
  await browserLogin(page);
  const requests: string[] = [];
  page.on('request', r => { if (r.url().includes('/api/')) requests.push(new URL(r.url()).pathname); });
  await page.goto('/panel/products');
  await page.getByPlaceholder(/Search products/).fill('Performance');
  await expect(page.getByRole('row').filter({ hasText: 'Performance product' }).first()).toBeVisible();
  measurements.browserRequestCounts = Object.fromEntries([...new Set(requests)].map(path => [path, requests.filter(p => p === path).length]));
  await testInfo.attach('performance-baseline', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
});
