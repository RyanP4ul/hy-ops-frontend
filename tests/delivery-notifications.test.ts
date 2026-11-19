import { expect, test } from "bun:test";
import { notificationPresentation } from "../lib/notification";
import { affectedQueryRoots } from "../lib/realtime";
import { formatCompactElapsedTime } from "../utils/time";

test("delivery notices link to operations with warning and success tones", () => {
  expect(notificationPresentation("DELIVERY_LOCATION_STOPPED")).toMatchObject({ href: "/panel/fleet-map", tone: "warning" });
  expect(notificationPresentation("DELIVERY_COMPLETED")).toMatchObject({ href: "/panel/deliveries", tone: "success" });
});
test("committed notification events refresh the feed and unread count", () => {
  expect(affectedQueryRoots({ type: "RESOURCE_CHANGED", payload: { resource: "notifications" } })).toEqual(["notification"]);
});
test("compact notification timestamps stay concise across past, future, and invalid inputs", () => {
  const now = Date.parse("2026-10-30T00:00:00Z");
  expect(formatCompactElapsedTime(now / 1000 - 20, now)).toBe("now");
  expect(formatCompactElapsedTime(now / 1000 - 120, now)).toBe("2m");
  expect(formatCompactElapsedTime(now / 1000 - 7200, now)).toBe("2h");
  expect(formatCompactElapsedTime(now / 1000 - 3 * 86400, now)).toBe("3d");
  expect(formatCompactElapsedTime(now / 1000 + 180, now)).toBe("in 3m");
  expect(formatCompactElapsedTime(null, now)).toBe("");
});
