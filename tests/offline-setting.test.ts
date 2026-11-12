import { expect, test } from "bun:test";
import { generalSettingSchema } from "../schema/setting";

const settings = {
  is_form_validation_debug_enabled: false, refresh_interval_ms: 30000,
  mobile_automatic_refresh_interval_ms: 30000, returning_automatic_confirm_ms_interval: 100,
  order_limit_per_day: 10, max_order_per_vehicle: 5,
};

test("General Settings supports enabling and disabling offline delivery recording", () => {
  for (const enabled of [true, false]) {
    const parsed = generalSettingSchema.parse({ ...settings, mobile_offline_delivery_recording_enabled: enabled });
    expect(String(parsed.mobile_offline_delivery_recording_enabled)).toBe(enabled ? "true" : "false");
  }
});

test("offline recording toggle requires a boolean rather than a truthy string", () => {
  for (const value of ["false", "true", 1, null]) {
    expect(generalSettingSchema.safeParse({ ...settings, mobile_offline_delivery_recording_enabled: value }).success).toBe(false);
  }
});
