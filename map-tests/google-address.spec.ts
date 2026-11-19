import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

test.beforeAll(async () => {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const { webpack } = require("next/dist/compiled/webpack/webpack");
  await new Promise<void>((resolve, reject) => {
    webpack({
      mode: "development", entry: path.resolve("map-tests/google-address-harness.tsx"),
      output: { path: path.resolve("test-results/google-address-bundle"), filename: "harness.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": process.cwd() } },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.resolve("map-tests/typescript-loader.cjs") }] },
    }, (error: Error | null, stats: { hasErrors(): boolean; toString(): string }) => {
      if (error) reject(error);
      else if (stats.hasErrors()) reject(new Error(stats.toString()));
      else resolve();
    });
  });
});

test.beforeEach(async ({ page }) => {
  await page.route("https://hyops.test/**", route => route.fulfill({
    contentType: route.request().url().endsWith(".js") ? "application/javascript" : "text/html",
    body: route.request().url().endsWith(".js")
      ? readFileSync("test-results/google-address-bundle/harness.js")
      : '<!doctype html><div id="root"></div><script src="/harness.js"></script>',
  }));
  await page.addInitScript(() => {
    class Autocomplete extends HTMLElement {
      placeholder = "";
      disabled = false;
      constructor(options: { includedRegionCodes: string[] }) {
        super();
        this.dataset.regions = options.includedRegionCodes.join(",");
      }
      connectedCallback() {
        const input = document.createElement("input");
        input.placeholder = this.placeholder;
        this.append(input);
      }
    }
    customElements.define("gmp-place-autocomplete", Autocomplete);
    Object.assign(window, { google: { maps: {
      Map: class {}, marker: {},
      importLibrary: async () => ({ PlaceAutocompleteElement: Autocomplete }),
    } } });
  });
});

test("Google selection returns the Philippine address fields and map coordinates", async ({ page }) => {
  await page.goto("https://hyops.test/");
  const widget = page.locator("gmp-place-autocomplete");
  await expect(widget).toHaveAttribute("data-regions", "ph");
  await widget.evaluate(element => {
    element.dispatchEvent(Object.assign(new Event("gmp-select"), { placePrediction: { toPlace: () => ({
      formattedAddress: "42 Mabini Street, Malolos, Bulacan 3000, Philippines",
      addressComponents: [
        { longText: "42", types: ["street_number"] }, { longText: "Mabini Street", types: ["route"] },
        { longText: "Malolos", types: ["locality"] }, { longText: "Bulacan", types: ["administrative_area_level_2"] },
        { longText: "Central Luzon", types: ["administrative_area_level_1"] }, { longText: "3000", types: ["postal_code"] },
      ],
      location: { toJSON: () => ({ lat: 14.85, lng: 120.81 }) },
      fetchFields: async (options: { fields: string[] }) => { element.dataset.fields = options.fields.join(","); },
    }) } }));
  });
  await expect(page.getByLabel("Selected address")).toHaveText(JSON.stringify({
    search_address: "42 Mabini Street, Malolos, Bulacan 3000, Philippines",
    street_address: "42 Mabini Street", city: "Malolos", state: "Bulacan", zip_code: "3000",
    latitude: 14.85, longitude: 120.81,
  }));
  await expect(widget).toHaveAttribute("data-fields", "addressComponents,formattedAddress,location");
});

test("search failures leave manual fields editable and allow retry", async ({ page }) => {
  await page.goto("https://hyops.test/");
  await expect(page.locator("gmp-place-autocomplete")).toBeVisible();
  await page.locator("gmp-place-autocomplete").dispatchEvent("gmp-error");
  await expect(page.getByRole("alert")).toContainText("Enter the address below");
  await page.getByLabel("Street address").fill("Verified manual address");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Street address")).toHaveValue("Verified manual address");
});

test("missing coordinates cannot replace the address; disabling preserves the search input", async ({ page }) => {
  await page.goto("https://hyops.test/");
  const input = page.getByPlaceholder("Search warehouse address");
  await input.fill("Malolos");
  await page.getByRole("button", { name: "Toggle disabled" }).click();
  expect(await page.locator("gmp-place-autocomplete").evaluate(element => Reflect.get(element, "disabled"))).toBe(true);
  await expect(input).toHaveValue("Malolos");
  await page.getByRole("button", { name: "Toggle disabled" }).click();
  await page.locator("gmp-place-autocomplete").evaluate(element => {
    element.dispatchEvent(Object.assign(new Event("gmp-select"), { placePrediction: { toPlace: () => ({
      formattedAddress: "No coordinates", fetchFields: async () => {},
    }) } }));
  });
  await expect(page.getByRole("alert")).toContainText("Try another result");
  await expect(page.getByLabel("Selected address")).toHaveText("null");
});
