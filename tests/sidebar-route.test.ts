import { expect, test } from "bun:test";
import { isSidebarRouteActive } from "../lib/sidebar-route";
import { getSidebars } from "../constant/left-sidebar";

test("sidebar URL matching handles direct links, nested routes and trailing slashes", () => {
  expect(isSidebarRouteActive("/panel", "/panel")).toBe(true);
  expect(isSidebarRouteActive("/panel/", "/panel")).toBe(true);
  expect(isSidebarRouteActive("/panel/orders/12", "/panel/orders")).toBe(true);
  expect(isSidebarRouteActive("/panel/orders/?status=COMPLETED#items", "/panel/orders/")).toBe(true);
  expect(isSidebarRouteActive("/panel/orders", "/panel")).toBe(false);
  expect(isSidebarRouteActive("/panel/orders-old", "/panel/orders")).toBe(false);
  expect(isSidebarRouteActive("/panel/fleet-map-old", "/panel/fleet-map")).toBe(false);
  expect(isSidebarRouteActive(null, "/panel")).toBe(false);
  expect(isSidebarRouteActive("/panel", "#")).toBe(false);
  expect(isSidebarRouteActive("/panel/orders", "/panel/orders", true)).toBe(false);
});

test("every visible menu URL activates exactly its own item regardless of display title", () => {
  for (const role of ["admin", "staff"]) {
    const items = Object.values(getSidebars(role)).flat();
    for (const item of items.filter(item => !item.isDisabled)) {
      for (const path of [item.url, `${item.url}/`]) {
        expect(items.filter(candidate => isSidebarRouteActive(path, candidate.url, candidate.isDisabled)).map(candidate => candidate.title)).toEqual([item.title]);
      }
    }
  }
});
