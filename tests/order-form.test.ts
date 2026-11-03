import { expect, test } from "bun:test";
import { orderSchema } from "../schema/order";

const draft = { warehouse_id: 1, customer_id: 1, delivery_type: "INTERNAL", payment_arrangement: "NET_30", payment_method: "CASH", amount_paid: 0, is_custom_shipping: false, customer_address_id: 1, shipping_recipient: "", shipping_phone: "", shipping_address: "", items: [{ inventory_id: 1, product_id: 1, product_variant_name: "Variant", product_variant_sku: "SKU", price: 12.34, quantity: 1, description: "" }] };

test("saved address checkout accepts unused blank manual address fields", () => {
  expect(orderSchema.safeParse(draft).success).toBe(true);
});
test("manual shipping still requires recipient, phone and address", () => {
  const result = orderSchema.safeParse({ ...draft, is_custom_shipping: true });
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.issues.map(issue => issue.path[0])).toEqual(expect.arrayContaining(["shipping_recipient", "shipping_phone", "shipping_address"]));
});
test("draft items require a selected inventory record and whole positive quantities", () => {
  for (const item of [{ ...draft.items[0], inventory_id: 0 }, { ...draft.items[0], quantity: 1.5 }, { ...draft.items[0], quantity: 0 }]) expect(orderSchema.safeParse({ ...draft, items: [item] }).success).toBe(false);
});

test("bank and card payments require a type and preserve custom names", () => {
  for (const payment_method of ["BANK_TRANSFER", "CARD"]) {
    for (const payment_type of [undefined, "", "   ", "x".repeat(101)]) {
      const result = orderSchema.safeParse({ ...draft, payment_method, payment_type });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues.some(issue => issue.path[0] === "payment_type")).toBe(true);
    }
    for (const payment_type of ["BDO", "Visa", " My custom provider "]) {
      const result = orderSchema.parse({ ...draft, payment_method, payment_type });
      expect(result.payment_type).toBe(payment_type.trim());
    }
  }
});
