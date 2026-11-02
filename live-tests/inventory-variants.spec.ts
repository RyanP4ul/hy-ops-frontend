import { expect, test } from "@playwright/test";
import { browserLogin, json } from "./helpers";

test.setTimeout(120_000);
test("Inventory variant picker excludes existing warehouse stock before pagination and clears on warehouse change", async ({ page }) => {
  await browserLogin(page);
  const product = await json(page.request, "POST", "/products", { name: "Available variants", version: 0, variants: Array.from({ length: 13 }, (_, index) => ({ name: `Available ${index}`, sku: `AVAIL-${String(index).padStart(2, "0")}`, price: "12.34", unit: "box", description: "Fixture", width_value: "0", width_unit: "m", length_value: "0", length_unit: "m", weight_kg: "0" })) });
  const variants = [...product.variants].sort((a, b) => a.id - b.id) as { id: number; sku: string }[];
  const other = await json(page.request, "POST", "/warehouses", { name: "Other variant warehouse", street_address: "Other street", city: "City", state: "Province", zip_code: "0000", latitude: 14.6, longitude: 121.2 });
  for (let index = 0; index < 3; index++) await json(page.request, "POST", "/inventory", { warehouse_id: 1, product_variant_id: variants[index].id, quantity: index === 0 ? 0 : 10 });
  await json(page.request, "POST", "/inventory", { warehouse_id: other.id, product_variant_id: variants[3].id, quantity: 1 });
  for (const search of ["", "&search=AVAIL-"]) {
    const first = await json(page.request, "GET", `/product_variants?exclude_inventory_warehouse_id=1&page=0&limit=5${search}`);
    const second = await json(page.request, "GET", `/product_variants?exclude_inventory_warehouse_id=1&page=1&limit=5${search}`);
    expect(first.total).toBe(10); expect(second.total).toBe(10);
    expect(first.rows.map((item: { id: number }) => item.id)).toEqual(variants.slice(3, 8).map(item => item.id));
    expect(second.rows.map((item: { id: number }) => item.id)).toEqual(variants.slice(8).map(item => item.id));
  }
  const unfiltered = await json(page.request, "GET", "/product_variants?page=0&limit=50");
  expect(unfiltered.rows.some((item: { id: number }) => item.id === variants[0].id)).toBe(true);

  await page.goto("/panel/inventory");
  await page.getByRole("button", { name: "Add Inventory Item", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("#product-variant")).toBeDisabled();
  async function warehouse(name: string) {
    await dialog.locator("#warehouse-name").click();
    await page.getByRole("option").filter({ hasText: name }).click();
    await expect(dialog.locator("#product-variant")).toBeEnabled();
  }
  await warehouse("Live warehouse");
  await dialog.locator("#product-variant").click();
  await expect(page.getByRole("option").filter({ hasText: variants[3].sku })).toBeVisible();
  await expect(page.getByRole("option").filter({ hasText: variants[0].sku })).toHaveCount(0);
  await page.getByRole("option").filter({ hasText: variants[3].sku }).click();
  await warehouse("Other variant warehouse");
  await expect(dialog.locator("#product-variant")).toHaveValue("");
  await dialog.locator("#product-variant").click();
  await expect(page.getByRole("option").filter({ hasText: variants[3].sku })).toHaveCount(0);
  await page.getByRole("option").filter({ hasText: variants[0].sku }).click();
  await dialog.locator("#quantity").fill("2");
  await dialog.getByRole("button", { name: "Add Inventory Item", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Add Inventory Item", exact: true }).click();
  await warehouse("Other variant warehouse");
  await dialog.locator("#product-variant").click();
  await expect(page.getByRole("option").filter({ hasText: variants[1].sku })).toBeVisible();
  await expect(page.getByRole("option").filter({ hasText: variants[0].sku })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  // Edit still displays the already-stored SKU, even though it is excluded from add choices.
  await page.getByPlaceholder("Search SKU or Product Name...").fill(variants[0].sku);
  const row = page.getByRole("row").filter({ hasText: variants[0].sku }).filter({ hasText: "Live warehouse" });
  await row.getByRole("button", { name: "Edit inventory", exact: true }).click();
  await expect(dialog.locator("#product-variant")).toHaveValue(variants[0].sku);
  await expect(dialog.locator("#product-variant")).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  for (const variant of variants.slice(3)) await json(page.request, "POST", "/inventory", { warehouse_id: 1, product_variant_id: variant.id, quantity: 0 });
  const empty = await json(page.request, "GET", "/product_variants?exclude_inventory_warehouse_id=1&page=0&limit=10");
  expect(empty).toEqual({ rows: [], total: 0 });
  await page.getByRole("button", { name: "Add Inventory Item", exact: true }).click();
  await warehouse("Live warehouse");
  await dialog.locator("#product-variant").click();
  await expect(page.getByText("All product variants are already in this warehouse inventory, or no variants match.", { exact: true })).toBeVisible();
});
