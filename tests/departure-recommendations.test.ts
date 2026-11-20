import { expect, test } from "bun:test";
import { format } from "date-fns";
import {
  formatTime12h,
  getDepartureTimePresets,
  getQuickDateOptions,
  getRecommendedDeparture,
  parseCalendarDateKey,
  type AvailableDateSlot,
} from "../lib/departure-recommendations";
import { isFutureManilaDeparture } from "../utils/date-util";

const sampleDates: AvailableDateSlot[] = [
  { date: "2026-11-20", available_slots: 5 },
  { date: "2026-11-21", available_slots: 5 },
  { date: "2026-11-23", available_slots: 4 },
  { date: "2026-11-24", available_slots: 5 },
  { date: "2026-11-25", available_slots: 5 },
];

test("formatTime12h converts 24-hour HH:mm strings cleanly", () => {
  expect(formatTime12h("00:15")).toBe("12:15 AM");
  expect(formatTime12h("08:00")).toBe("8:00 AM");
  expect(formatTime12h("12:00")).toBe("12:00 PM");
  expect(formatTime12h("13:30")).toBe("1:30 PM");
  expect(formatTime12h("23:59")).toBe("11:59 PM");
  expect(formatTime12h("")).toBe("");
});

test("parseCalendarDateKey produces local calendar midnight without UTC drift", () => {
  const parsed = parseCalendarDateKey("2026-11-20");
  expect(format(parsed, "yyyy-MM-dd")).toBe("2026-11-20");
  expect(parsed.getHours()).toBe(0);
  expect(parsed.getMinutes()).toBe(0);
});

test("recommends same-day 08:00 when Manila time is early morning", () => {
  const now = new Date("2026-11-20T06:45:00+08:00");
  const rec = getRecommendedDeparture(sampleDates, 1, now);
  expect(rec).not.toBeNull();
  expect(rec?.dateKey).toBe("2026-11-20");
  expect(rec?.time).toBe("08:00");
  expect(rec?.isToday).toBe(true);
  expect(rec?.meetsStopRequirement).toBe(true);
  expect(isFutureManilaDeparture(rec!.dateKey, rec!.time, now.getTime())).toBe(true);
});

test("recommends same-day next 30-minute dispatch window with 30-minute prep buffer", () => {
  const now = new Date("2026-11-20T09:15:00+08:00");
  const rec = getRecommendedDeparture(sampleDates, 1, now);
  expect(rec?.dateKey).toBe("2026-11-20");
  expect(rec?.time).toBe("10:00");
  expect(rec?.isToday).toBe(true);
  expect(isFutureManilaDeparture(rec!.dateKey, rec!.time, now.getTime())).toBe(true);
});

test("rolls over to next operating day 08:00 after regular Manila dispatch cutoff (17:00)", () => {
  const now = new Date("2026-11-20T18:26:00+08:00");
  const rec = getRecommendedDeparture(sampleDates, 1, now);
  expect(rec?.dateKey).toBe("2026-11-21");
  expect(rec?.time).toBe("08:00");
  expect(rec?.isToday).toBe(false);
  expect(rec?.isTomorrow).toBe(true);
  expect(isFutureManilaDeparture(rec!.dateKey, rec!.time, now.getTime())).toBe(true);
});

test("skips dates that lack enough slots for pre-selected order groups", () => {
  const now = new Date("2026-11-20T09:00:00+08:00");
  const limitedDates: AvailableDateSlot[] = [
    { date: "2026-11-20", available_slots: 2 },
    { date: "2026-11-21", available_slots: 2 },
    { date: "2026-11-23", available_slots: 5 },
  ];
  const rec = getRecommendedDeparture(limitedDates, 4, now);
  expect(rec?.dateKey).toBe("2026-11-23");
  expect(rec?.time).toBe("08:00");
  expect(rec?.meetsStopRequirement).toBe(true);
  expect(rec?.reason).toContain("4 stops");
});

test("falls back to soonest available date when no date meets required stop count", () => {
  const now = new Date("2026-11-20T09:00:00+08:00");
  const limitedDates: AvailableDateSlot[] = [
    { date: "2026-11-20", available_slots: 2 },
    { date: "2026-11-21", available_slots: 3 },
  ];
  const rec = getRecommendedDeparture(limitedDates, 6, now);
  expect(rec?.dateKey).toBe("2026-11-20");
  expect(rec?.meetsStopRequirement).toBe(false);
});

test("returns null when no dates have open slots", () => {
  const now = new Date("2026-11-20T09:00:00+08:00");
  expect(getRecommendedDeparture([], 1, now)).toBeNull();
  expect(
    getRecommendedDeparture([{ date: "2026-11-20", available_slots: 0 }], 1, now),
  ).toBeNull();
});

test("quick date options always include the recommended date within the max count", () => {
  const now = new Date("2026-11-20T09:00:00+08:00");
  const dates: AvailableDateSlot[] = [
    { date: "2026-11-20", available_slots: 1 },
    { date: "2026-11-21", available_slots: 1 },
    { date: "2026-11-23", available_slots: 1 },
    { date: "2026-11-24", available_slots: 1 },
    { date: "2026-11-25", available_slots: 5 },
  ];
  const rec = getRecommendedDeparture(dates, 4, now);
  const quick = getQuickDateOptions(dates, rec, 4, now, 4);
  expect(quick).toHaveLength(4);
  expect(quick.some((item) => item.dateKey === "2026-11-25" && item.isRecommended)).toBe(true);
  expect(quick[0].relativeLabel).toBe("Today");
  expect(quick[1].relativeLabel).toBe("Tomorrow");
});

test("same-day time presets omit expired morning slots and provide valid evening slots at 18:26 Manila", () => {
  const now = new Date("2026-11-20T18:26:00+08:00");
  const rec = getRecommendedDeparture(sampleDates, 1, now);
  const presets = getDepartureTimePresets("2026-11-20", rec, now);

  expect(presets.length).toBeGreaterThanOrEqual(3);
  expect(presets[0].value).toBe("19:00");
  expect(presets[0].isRecommended).toBe(true);
  for (const preset of presets) {
    expect(preset.disabled).toBe(false);
    expect(isFutureManilaDeparture("2026-11-20", preset.value, now.getTime())).toBe(true);
  }
});

test("future-date time presets provide standard dispatch windows with 08:00 recommended", () => {
  const now = new Date("2026-11-20T18:26:00+08:00");
  const rec = getRecommendedDeparture(sampleDates, 1, now);
  const presets = getDepartureTimePresets("2026-11-21", rec, now);

  expect(presets).toHaveLength(6);
  expect(presets[0].value).toBe("08:00");
  expect(presets[0].isRecommended).toBe(true);
  expect(presets.every((preset) => !preset.disabled)).toBe(true);
});

test("returns empty presets for today after 23:00 Manila when no valid 30-min buffered time remains", () => {
  const now = new Date("2026-11-20T23:45:00+08:00");
  const rec = getRecommendedDeparture(sampleDates, 1, now);
  const presets = getDepartureTimePresets("2026-11-20", rec, now);
  expect(presets).toHaveLength(0);
});
