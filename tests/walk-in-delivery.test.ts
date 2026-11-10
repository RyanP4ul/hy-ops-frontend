import { describe, expect, test } from "bun:test";
import { walkInOrderFormSchema } from "../schema/walk-in-order";

const cart = {
  warehouse_id: 1, buyer_mode: "GUEST", payment_method: "CASH", amount_tendered: 1000,
  items: [{ inventory_id: 1, sku: "BULK", product_name: "Bulk product", price: 10, available: 150, quantity: 100 }],
};
const delivery = {
  ...cart, fulfillment: "DELIVERY", shipping_recipient: "Juan", shipping_phone: "09171234567",
  shipping_address: "100 Customer Street", shipping_latitude: 14.5, shipping_longitude: 121.1,
};

describe("walk-in fulfillment validation", () => {
  test("existing checkout defaults to takeaway without requiring delivery details", () => {
    expect(walkInOrderFormSchema.parse(cart).fulfillment).toBe("TAKEAWAY");
  });
  test("large guest and registered deliveries accept complete customer details", () => {
    expect(walkInOrderFormSchema.safeParse(delivery).success).toBe(true);
    expect(walkInOrderFormSchema.safeParse({ ...delivery, buyer_mode: "REGISTERED", customer_id: 1, customer_address_id: 1 }).success).toBe(true);
  });
  test("delivery requires name, phone, address, and valid destination coordinates", () => {
    for (const override of [
      { shipping_recipient: " " }, { shipping_phone: "" }, { shipping_phone: "abcdefg" },
      { shipping_address: " " }, { shipping_latitude: undefined }, { shipping_longitude: undefined },
      { shipping_latitude: 0, shipping_longitude: 0 }, { shipping_latitude: 91 },
    ]) expect(walkInOrderFormSchema.safeParse({ ...delivery, ...override }).success).toBe(false);
  });
  test("delivery retains full payment and stock availability requirements", () => {
    expect(walkInOrderFormSchema.safeParse({ ...delivery, amount_tendered: 999 }).success).toBe(false);
    expect(walkInOrderFormSchema.safeParse({ ...delivery, items: [{ ...cart.items[0], quantity: 151 }] }).success).toBe(false);
    expect(walkInOrderFormSchema.safeParse({ ...delivery, payment_method: "CARD" }).success).toBe(false);
  });
});
