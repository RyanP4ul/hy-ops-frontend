import { expect, test } from "bun:test";
import { notificationPresentation } from "../lib/notification";
import { affectedQueryRoots } from "../lib/realtime";

test("delivery notices link to operations with warning and success tones", () => {
  expect(notificationPresentation("DELIVERY_LOCATION_STOPPED")).toMatchObject({ href: "/panel/fleet-map", tone: "warning" });
  expect(notificationPresentation("DELIVERY_COMPLETED")).toMatchObject({ href: "/panel/deliveries", tone: "success" });
});
test("committed notification events refresh the feed and unread count", () => {
  expect(affectedQueryRoots({ type: "RESOURCE_CHANGED", payload: { resource: "notifications" } })).toEqual(["notification"]);
});
