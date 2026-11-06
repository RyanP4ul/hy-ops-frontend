import { expect, test } from "bun:test";
import { orderBatchFormSchema, toOrderBatchPayload, allocateCombinedPayment, draftForPaymentMode, previewCombinedOrders } from "../schema/order-batch";

const order = { warehouse_id: 1, customer_id: 7, delivery_type: "INTERNAL", payment_arrangement: "NET_30", payment_method: "CASH", amount_paid: 0, is_custom_shipping: false, customer_address_id: 1, items: [{ inventory_id: 1, product_id: 1, product_variant_name: "Variant", product_variant_sku: "SKU", price: 12.34, quantity: 1, description: "" }] };

test("batch payload selects the customer once and preserves each order's destination, items and payment", () => {
  const batch = orderBatchFormSchema.parse({ customer_id: 7, orders: [order, { ...order, customer_address_id: 2, amount_paid: 5, payment_method: "BANK_TRANSFER", payment_type: " BDO ", items: [{ ...order.items[0], quantity: 2 }] }] });
  const payload = toOrderBatchPayload(batch);
  expect(payload.customer_id).toBe(7);
  expect(payload.orders[0]).not.toHaveProperty("customer_id");
  expect(payload.orders[1]).not.toHaveProperty("customer_id");
  expect(payload.orders[0]).toMatchObject({ customer_address_id: 1, amount_paid: 0 });
  expect(payload.orders[1]).toMatchObject({ customer_address_id: 2, amount_paid: 5, payment_type: "BDO", items: [{ quantity: 2 }] });
});

test("all drafts must have the same customer and their own saved shipping address", () => {
  for (const other of [{ ...order, customer_id: 8 }, { ...order, customer_address_id: undefined }, { ...order, is_custom_shipping: true }]) {
    expect(orderBatchFormSchema.safeParse({ customer_id: 7, orders: [order, other] }).success).toBe(false);
  }
  expect(orderBatchFormSchema.safeParse({ customer_id: 7, orders: [order] }).success).toBe(true);
  expect(orderBatchFormSchema.safeParse({ customer_id: 7, orders: [] }).success).toBe(false);
  expect(orderBatchFormSchema.safeParse({ customer_id: 7, orders: Array.from({ length: 26 }, () => order) }).success).toBe(false);
});

test("a prepared order cannot bypass payment or price validation after another order is edited", () => {
  for (const other of [
    { ...order, amount_paid: 20 }, { ...order, payment_arrangement: "FULLY_PAID", amount_paid: 0 },
    { ...order, payment_arrangement: "PARTIALLY_PAID", amount_paid: 0 },
    { ...order, items: [{ ...order.items[0], price: undefined }] },
  ]) {
    const result = orderBatchFormSchema.safeParse({ customer_id: 7, orders: [other, order] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path.slice(0, 2)).toEqual(["orders", 0]);
  }
});

test("combined mode validates one payment, preserves original per-order entries, and sends one shared method", () => {
  const original = { ...order, payment_method: "BANK_TRANSFER", payment_type: "Original bank", amount_paid: 5 };
  const normalized = draftForPaymentMode(original, "COMBINED");
  expect(normalized).toMatchObject({ payment_method: "CASH", amount_paid: 0 });
  expect(original).toMatchObject({ payment_type: "Original bank", amount_paid: 5 });
  expect(draftForPaymentMode(original, "SEPARATE")).toEqual(original);
  const config = { payment_method: "BANK_TRANSFER" as const, payment_type: " BDO ", amount_paid: 10, reference_number: "BANK-REF" };
  const batch = orderBatchFormSchema.parse({ customer_id: 7, payment_mode: "COMBINED", combined_payment: config, orders: [original, { ...order, items: [{ ...order.items[0], quantity: 2 }] }] });
  const payload = toOrderBatchPayload(batch);
  expect(payload).toMatchObject({ payment_mode: "COMBINED", payment: { payment_method: "BANK_TRANSFER", payment_type: "BDO", amount_paid: 10 } });
  expect(payload.orders[0]).not.toHaveProperty("amount_paid");
  expect(payload.orders[0]).not.toHaveProperty("payment_method");
  expect(payload.orders[0]).toHaveProperty("expected_total", 12.34);
  expect(previewCombinedOrders([original, { ...order, items: [{ ...order.items[0], quantity: 2 }] }], config).map(row => row.amount_paid)).toEqual([3.33, 6.67]);
  expect(allocateCombinedPayment(0.01, [12.34, 12.34])).toEqual([0.01, 0]);
  expect(allocateCombinedPayment(37.02, [12.34, 24.68])).toEqual([12.34, 24.68]);
});

test("combined mode rejects incomplete payment details, excess amounts and fractional centavos", () => {
  for (const payment of [undefined, { payment_method: "CASH", amount_paid: 0 }, { payment_method: "CASH", amount_paid: 50 }, { payment_method: "BANK_TRANSFER", amount_paid: 5, payment_type: " " }, { payment_method: "CASH", amount_paid: 1.001 }]) {
    expect(orderBatchFormSchema.safeParse({ customer_id: 7, payment_mode: "COMBINED", combined_payment: payment, orders: [order, order] }).success).toBe(false);
  }
});
