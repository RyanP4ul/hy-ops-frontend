import { expect, test } from "@playwright/test";
import { browserLogin } from "./helpers";

test("Staff warehouse assignment is automatic in orders, walk-in sales and delivery schedules", async ({ page }) => {
  await browserLogin(page, "staff@example.test");
  await page.goto("/panel/orders");
  await page.getByRole("button", { name: "Add order", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Assigned warehouse: Live warehouse", { exact: true })).toBeVisible();
  await expect(dialog.getByPlaceholder("Select warehouse name...")).toHaveCount(0);
  await dialog.getByPlaceholder("Select customer name...").click();
  await page.getByRole("option").filter({ hasText: "Live Customer" }).click();
  await dialog.getByLabel("Saved shipping address", { exact: false }).click();
  await page.getByRole("option").filter({ hasText: "Fixture street" }).click();
  await dialog.getByRole("button", { name: "Continue to order items", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Build your order", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Add order", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Assigned warehouse: Live warehouse", { exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "Walk-in sale", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Assigned warehouse: Live warehouse", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Select warehouse", { exact: true })).toHaveCount(0);
  await expect(dialog.getByPlaceholder("Search or scan SKU / product name...")).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).first().click();

  await page.goto("/panel/delivery-schedules");
  await page.getByRole("button", { name: "Schedule delivery", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Assigned warehouse: Live warehouse", { exact: true })).toBeVisible();
  await expect(dialog.getByPlaceholder("Select warehouse name...")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Continue to departure", exact: true }).click();
  await expect(dialog.getByText("Departure dates and times use Asia/Manila.", { exact: true })).toBeVisible();
});

test("Admin warehouse assignment keeps the warehouse pickers in orders and delivery schedules", async ({ page }) => {
  await browserLogin(page);
  await page.goto("/panel/orders");
  await page.getByRole("button", { name: "Add order", exact: true }).click();
  await expect(page.getByRole("dialog").getByPlaceholder("Select warehouse name...")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/panel/delivery-schedules");
  await page.getByRole("button", { name: "Schedule delivery", exact: true }).click();
  await expect(page.getByRole("dialog").getByPlaceholder("Select warehouse name...")).toBeVisible();
});

