import { expect, test } from "bun:test";
import { normalizePhone, validPhone, smsPreview, smsVariables, type SmsTemplate } from "../lib/communications";

const template: SmsTemplate = { id: 1, name: "Greeting", content: "Hi {{ name }}, order {{order.id}}: {{name}}", variables: ["name"], is_active: true, usage_count: 0, created_at: "2026-11-02" };
test("SMS variables combine gateway metadata and placeholders without duplicate fields", () => {
  expect(smsVariables(template)).toEqual(["name", "order.id"]);
  expect(smsPreview(template, { name: "$&", "order.id": "<b>ORDER-1</b>" })).toBe("Hi $&, order <b>ORDER-1</b>: $&");
  expect(smsPreview(template, {})).toBe(template.content);
});
test("phone normalization preserves local leading zeros and international plus", () => {
  expect(normalizePhone("(0912) 345-6789")).toBe("09123456789");
  expect(normalizePhone("+63 912 345 6789")).toBe("+639123456789");
  expect(validPhone("+63 912 345 6789")).toBe(true);
  for (const invalid of ["", "123", "abc09123456789", "++639123456789", "1234567890123456"]) expect(validPhone(invalid)).toBe(false);
});
