import { expect, test } from "bun:test";
import {
  filterSidebarGroups,
  getFirstMatchingSidebarUrl,
  isSidebarRouteActive,
} from "../lib/sidebar-route";
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
    const items = Object.values(getSidebars(role))
      .flat()
      .flatMap((item) => [item, ...(item.items ?? [])]);
    for (const item of items.filter(item => !item.isDisabled)) {
      for (const path of [item.url, `${item.url}/`]) {
        expect(items.filter(candidate => isSidebarRouteActive(path, candidate.url, candidate.isDisabled)).map(candidate => candidate.title)).toEqual([item.title]);
      }
    }
  }
});

test("Deliveries exposes Lalamove as a submenu item for admin and staff", () => {
  for (const role of ["admin", "staff"]) {
    const logistics = getSidebars(role)["Logistics & Tracking"];
    const deliveries = logistics?.find((item) => item.title === "Deliveries");
    expect(deliveries?.items?.map((sub) => ({ title: sub.title, url: sub.url }))).toEqual([
      { title: "Lalamove", url: "/panel/lalamove" },
    ]);
  }
});

test("sidebar search filters groups, items and submenus and resolves first Enter target", () => {
  const adminSidebar = getSidebars("admin");

  expect(Object.keys(filterSidebarGroups(adminSidebar, ""))).toEqual(
    Object.keys(adminSidebar),
  );

  const lalamoveMatch = filterSidebarGroups(adminSidebar, "lalamove");
  expect(Object.keys(lalamoveMatch)).toEqual(["Logistics & Tracking"]);
  expect(lalamoveMatch["Logistics & Tracking"].map((item) => item.title)).toEqual([
    "Deliveries",
  ]);
  expect(
    lalamoveMatch["Logistics & Tracking"][0].items?.map((sub) => sub.title),
  ).toEqual(["Lalamove"]);
  expect(getFirstMatchingSidebarUrl(adminSidebar, "lalamove")).toBe(
    "/panel/lalamove",
  );

  const commsMatch = filterSidebarGroups(adminSidebar, "COMM");
  expect(Object.keys(commsMatch)).toEqual(["Communications"]);
  expect(getFirstMatchingSidebarUrl(adminSidebar, "COMM")).toBe(
    "/panel/communications",
  );

  expect(filterSidebarGroups(adminSidebar, "nonexistent-module")).toEqual({});
  expect(getFirstMatchingSidebarUrl(adminSidebar, "nonexistent-module")).toBeNull();
});
