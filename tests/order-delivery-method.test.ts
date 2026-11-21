import { expect, test } from "bun:test";
import { summarizeGroupDeliveryMethods } from "../schema/order";

test("summarizeGroupDeliveryMethods returns single method when all active members match", () => {
  expect(
    summarizeGroupDeliveryMethods([
      { status: "PENDING", delivery_type: "INTERNAL" },
      { status: "PROCESSING", delivery_type: "INTERNAL" },
    ]),
  ).toEqual([{ method: "INTERNAL", count: 2 }]);

  expect(
    summarizeGroupDeliveryMethods([
      { status: "SCHEDULING", delivery_type: "LALAMOVE" },
      { status: "CANCELLED", delivery_type: "INTERNAL" },
    ]),
  ).toEqual([{ method: "LALAMOVE", count: 1 }]);
});

test("summarizeGroupDeliveryMethods preserves display order for mixed internal and lalamove groups", () => {
  expect(
    summarizeGroupDeliveryMethods([
      { status: "PENDING", delivery_type: "LALAMOVE" },
      { status: "PROCESSING", delivery_type: "INTERNAL" },
      { status: "SCHEDULING", delivery_type: "INTERNAL" },
    ]),
  ).toEqual([
    { method: "INTERNAL", count: 2 },
    { method: "LALAMOVE", count: 1 },
  ]);
});

test("summarizeGroupDeliveryMethods handles unassigned and all-cancelled groups", () => {
  expect(
    summarizeGroupDeliveryMethods([
      { status: "PENDING", delivery_type: null },
      { status: "PENDING", delivery_type: undefined },
    ]),
  ).toEqual([{ method: null, count: 2 }]);

  expect(
    summarizeGroupDeliveryMethods([
      { status: "CANCELLED", delivery_type: "LALAMOVE" },
      { status: "CANCELLED", delivery_type: "INTERNAL" },
    ]),
  ).toEqual([
    { method: "INTERNAL", count: 1 },
    { method: "LALAMOVE", count: 1 },
  ]);
});
