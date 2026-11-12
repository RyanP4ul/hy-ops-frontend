import { expect, test } from "bun:test";
import { remainingDraftStock } from "../lib/order-stock";

test("selections deduct shared stock across drafts without changing inventory or drafts", () => {
  const inventory = { id: 1, quantity: 10 };
  const drafts = [
    { items: [{ inventory_id: 1, quantity: 3 }, { inventory_id: 2, quantity: 5 }] },
    { items: [{ inventory_id: 1, quantity: 2 }] },
  ];
  const original = structuredClone(drafts);
  expect(remainingDraftStock(inventory.quantity, inventory.id, drafts)).toBe(5);
  expect(inventory.quantity).toBe(10);
  expect(drafts).toEqual(original);
});

test("editing, removing and clearing selections restores their available quantity", () => {
  const draft = { items: [{ inventory_id: 1, quantity: 3 }] };
  expect(remainingDraftStock(10, 1, [draft])).toBe(7);
  draft.items[0].quantity = 1;
  expect(remainingDraftStock(10, 1, [draft])).toBe(9);
  expect(remainingDraftStock(10, 1, [])).toBe(10);
  expect(remainingDraftStock(2, 1, [draft, draft, draft])).toBe(0);
});
