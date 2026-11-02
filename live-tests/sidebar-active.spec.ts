import { expect, test } from "@playwright/test";
import { browserLogin } from "./helpers";

test("Sidebar active link follows navigation, browser history, direct URLs and reloads", async ({ page }) => {
  await browserLogin(page);
  const current = page.locator('[data-slot="sidebar-menu-button"][aria-current="page"]');
  async function active(name: string) {
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText(name);
    await expect(current).toHaveAttribute("data-active", /^(true)?$/);
    await expect(page.getByRole("link", { name, exact: true }).first()).toHaveAttribute("aria-current", "page");
  }
  await active("Dashboard");
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page).toHaveURL(/\/panel\/orders$/);
  await active("Orders");
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await expect(page).toHaveURL(/\/panel\/inventory$/);
  await active("Inventory");
  await page.goBack();
  await active("Orders");
  await page.goForward();
  await active("Inventory");
  await page.goto("/panel/delivery-expenses?view=summary");
  await active("Delivery Expenses Calculator");
  await page.reload();
  await active("Delivery Expenses Calculator");
  await page.goto("/panel/analysis-reports");
  await active("Analysis & Reports");
});
