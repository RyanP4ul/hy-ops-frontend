import { addDays, format, startOfDay } from "date-fns";
import { isFutureManilaDeparture, manilaCalendarNow } from "@/utils/date-util";

export type AvailableDateSlot = {
  date: string;
  available_slots: number;
};

export type DepartureRecommendation = {
  dateKey: string;
  date: Date;
  time: string;
  availableSlots: number;
  meetsStopRequirement: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  reason: string;
};

export type QuickDateOption = {
  dateKey: string;
  date: Date;
  relativeLabel: string;
  shortDateLabel: string;
  availableSlots: number;
  meetsStopRequirement: boolean;
  isRecommended: boolean;
};

export type DepartureTimePreset = {
  value: string;
  label: string;
  period: string;
  disabled: boolean;
  isRecommended: boolean;
  isDynamic?: boolean;
};

const DISPATCH_START_MINUTES = 8 * 60; // 08:00
const REGULAR_CUTOFF_MINUTES = 17 * 60; // 17:00
const LAST_SAME_DAY_MINUTES = 23 * 60 + 30; // 23:30
const SAME_DAY_LEAD_MINUTES = 30;

const STANDARD_TIME_PRESETS: ReadonlyArray<{
  value: string;
  minutes: number;
  period: string;
}> = [
  { value: "08:00", minutes: 8 * 60, period: "Early" },
  { value: "09:00", minutes: 9 * 60, period: "Morning" },
  { value: "10:00", minutes: 10 * 60, period: "Mid-AM" },
  { value: "13:00", minutes: 13 * 60, period: "Afternoon" },
  { value: "15:00", minutes: 15 * 60, period: "Mid-PM" },
  { value: "17:00", minutes: 17 * 60, period: "Late PM" },
];

/**
 * Parse a YYYY-MM-DD calendar key into a local midnight Date for react-day-picker
 * and date-fns formatting, without UTC-midnight timezone drift.
 */
export function parseCalendarDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatTime12h(time: string | null | undefined): string {
  if (!time) return "";
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return time;
  const hours24 = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours24) || !Number.isInteger(minutes) || hours24 < 0 || hours24 > 23 || minutes < 0 || minutes > 59) {
    return time;
  }
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function getEarliestSameDayMinutes(
  manilaNow: Date,
  leadMinutes = SAME_DAY_LEAD_MINUTES,
): number | null {
  const nowMinutes = manilaNow.getHours() * 60 + manilaNow.getMinutes();
  if (nowMinutes <= DISPATCH_START_MINUTES - leadMinutes) {
    return DISPATCH_START_MINUTES;
  }
  const rounded = Math.ceil((nowMinutes + leadMinutes) / 30) * 30;
  if (rounded > LAST_SAME_DAY_MINUTES) {
    return null;
  }
  return rounded;
}

export function getRecommendedDeparture(
  availableDates: readonly AvailableDateSlot[] | undefined,
  requiredStops = 1,
  nowInstant: Date = new Date(),
): DepartureRecommendation | null {
  if (!availableDates?.length) return null;

  const neededStops = Math.max(1, requiredStops);
  const manilaNow = manilaCalendarNow(nowInstant);
  const todayStart = startOfDay(manilaNow);
  const todayKey = format(todayStart, "yyyy-MM-dd");
  const tomorrowKey = format(addDays(todayStart, 1), "yyyy-MM-dd");

  const sorted = [...availableDates]
    .filter((item) => item.date >= todayKey && item.available_slots >= 1)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!sorted.length) return null;

  const matchingCapacity = sorted.filter(
    (item) => item.available_slots >= neededStops,
  );
  const meetsStopRequirement = matchingCapacity.length > 0;
  const candidates = meetsStopRequirement ? matchingCapacity : sorted;
  const firstCandidate = candidates[0];

  const todayEntry = availableDates.find((item) => item.date === todayKey);
  const todaySkippedForCapacity =
    meetsStopRequirement &&
    neededStops > 1 &&
    Boolean(todayEntry && todayEntry.available_slots > 0 && todayEntry.available_slots < neededStops);

  if (firstCandidate.date === todayKey) {
    const earliestMinutes = getEarliestSameDayMinutes(manilaNow);
    const earliestTime =
      earliestMinutes !== null ? formatMinutesToHHMM(earliestMinutes) : null;

    if (
      earliestMinutes !== null &&
      earliestTime !== null &&
      earliestMinutes <= REGULAR_CUTOFF_MINUTES &&
      isFutureManilaDeparture(todayKey, earliestTime, nowInstant.getTime())
    ) {
      return {
        dateKey: todayKey,
        date: parseCalendarDateKey(todayKey),
        time: earliestTime,
        availableSlots: firstCandidate.available_slots,
        meetsStopRequirement,
        isToday: true,
        isTomorrow: false,
        reason: !meetsStopRequirement
          ? `Soonest open date · fewer than ${neededStops} stop slots`
          : earliestMinutes === DISPATCH_START_MINUTES
            ? "Same-day morning dispatch"
            : "Earliest same-day dispatch (30+ min prep)",
      };
    }

    const nextOperatingDay = candidates.find((item) => item.date > todayKey);
    if (nextOperatingDay) {
      const isTomorrow = nextOperatingDay.date === tomorrowKey;
      return {
        dateKey: nextOperatingDay.date,
        date: parseCalendarDateKey(nextOperatingDay.date),
        time: "08:00",
        availableSlots: nextOperatingDay.available_slots,
        meetsStopRequirement,
        isToday: false,
        isTomorrow,
        reason: !meetsStopRequirement
          ? `Next operating day · fewer than ${neededStops} stop slots`
          : isTomorrow
            ? "Next operating day · Morning dispatch"
            : "Earliest operating day · Morning dispatch",
      };
    }

    if (
      earliestTime !== null &&
      isFutureManilaDeparture(todayKey, earliestTime, nowInstant.getTime())
    ) {
      return {
        dateKey: todayKey,
        date: parseCalendarDateKey(todayKey),
        time: earliestTime,
        availableSlots: firstCandidate.available_slots,
        meetsStopRequirement,
        isToday: true,
        isTomorrow: false,
        reason: "Only available date · Earliest valid departure",
      };
    }

    return null;
  }

  const isTomorrow = firstCandidate.date === tomorrowKey;
  let reason: string;
  if (!meetsStopRequirement) {
    reason = `Soonest open date · fewer than ${neededStops} stop slots`;
  } else if (todaySkippedForCapacity) {
    reason = `Earliest date fitting ${neededStops} stops · Morning dispatch`;
  } else if (isTomorrow) {
    reason = "Next operating day · Morning dispatch";
  } else {
    reason = "Earliest available date · Morning dispatch";
  }

  return {
    dateKey: firstCandidate.date,
    date: parseCalendarDateKey(firstCandidate.date),
    time: "08:00",
    availableSlots: firstCandidate.available_slots,
    meetsStopRequirement,
    isToday: false,
    isTomorrow,
    reason,
  };
}

export function getQuickDateOptions(
  availableDates: readonly AvailableDateSlot[] | undefined,
  recommendation: DepartureRecommendation | null,
  requiredStops = 1,
  nowInstant: Date = new Date(),
  maxCount = 4,
): QuickDateOption[] {
  if (!availableDates?.length) return [];

  const neededStops = Math.max(1, requiredStops);
  const manilaNow = manilaCalendarNow(nowInstant);
  const todayStart = startOfDay(manilaNow);
  const todayKey = format(todayStart, "yyyy-MM-dd");
  const tomorrowKey = format(addDays(todayStart, 1), "yyyy-MM-dd");

  const sorted = [...availableDates]
    .filter((item) => item.date >= todayKey && item.available_slots >= 1)
    .sort((a, b) => a.date.localeCompare(b.date));

  const picked = sorted.slice(0, maxCount);
  if (
    recommendation &&
    !picked.some((item) => item.date === recommendation.dateKey)
  ) {
    const recItem = sorted.find((item) => item.date === recommendation.dateKey);
    if (recItem) {
      if (picked.length >= maxCount) {
        picked[maxCount - 1] = recItem;
      } else {
        picked.push(recItem);
      }
      picked.sort((a, b) => a.date.localeCompare(b.date));
    }
  }

  return picked.map((item) => {
    const date = parseCalendarDateKey(item.date);
    const relativeLabel =
      item.date === todayKey
        ? "Today"
        : item.date === tomorrowKey
          ? "Tomorrow"
          : format(date, "EEE");

    return {
      dateKey: item.date,
      date,
      relativeLabel,
      shortDateLabel: format(date, "MMM d"),
      availableSlots: item.available_slots,
      meetsStopRequirement: item.available_slots >= neededStops,
      isRecommended: recommendation?.dateKey === item.date,
    };
  });
}

export function getDepartureTimePresets(
  selectedDateKey: string | undefined,
  recommendation: DepartureRecommendation | null,
  nowInstant: Date = new Date(),
): DepartureTimePreset[] {
  const manilaNow = manilaCalendarNow(nowInstant);
  const todayKey = format(startOfDay(manilaNow), "yyyy-MM-dd");

  if (!selectedDateKey || selectedDateKey > todayKey) {
    const recommendedValue =
      selectedDateKey && recommendation?.dateKey === selectedDateKey
        ? recommendation.time
        : "08:00";

    return STANDARD_TIME_PRESETS.map((preset) => ({
      value: preset.value,
      label: formatTime12h(preset.value),
      period: preset.period,
      disabled: false,
      isRecommended: preset.value === recommendedValue,
    }));
  }

  if (selectedDateKey < todayKey) {
    return STANDARD_TIME_PRESETS.map((preset) => ({
      value: preset.value,
      label: formatTime12h(preset.value),
      period: preset.period,
      disabled: true,
      isRecommended: false,
    }));
  }

  // Selected date is Today in Asia/Manila
  const earliestMinutes = getEarliestSameDayMinutes(manilaNow);
  const nowMs = nowInstant.getTime();
  const standardFuture = STANDARD_TIME_PRESETS.filter((preset) =>
    isFutureManilaDeparture(todayKey, preset.value, nowMs),
  );

  const candidates: Array<{
    value: string;
    minutes: number;
    period: string;
    isDynamic?: boolean;
  }> = [];

  if (earliestMinutes !== null) {
    const earliestValue = formatMinutesToHHMM(earliestMinutes);
    if (isFutureManilaDeparture(todayKey, earliestValue, nowMs)) {
      const existing = standardFuture.find(
        (preset) => preset.value === earliestValue,
      );
      if (!existing) {
        candidates.push({
          value: earliestValue,
          minutes: earliestMinutes,
          period: "Earliest",
          isDynamic: true,
        });
      }
    }
  }

  for (const preset of standardFuture) {
    candidates.push(preset);
  }

  // If it's late afternoon/evening (fewer than 4 standard daytime presets left),
  // add sensible upcoming evening intervals so same-day dispatchers still have valid quick picks.
  if (earliestMinutes !== null && candidates.length < 4) {
    const eveningOffsets = [30, 60, 120, 180];
    for (const offset of eveningOffsets) {
      if (candidates.length >= 6) break;
      const candidateMinutes = earliestMinutes + offset;
      if (candidateMinutes > LAST_SAME_DAY_MINUTES) break;
      const value = formatMinutesToHHMM(candidateMinutes);
      if (
        !candidates.some((item) => item.value === value) &&
        isFutureManilaDeparture(todayKey, value, nowMs)
      ) {
        candidates.push({
          value,
          minutes: candidateMinutes,
          period: candidateMinutes >= 18 * 60 ? "Evening" : "Later",
          isDynamic: true,
        });
      }
    }
  }

  candidates.sort((a, b) => a.minutes - b.minutes);
  const visible = candidates.slice(0, 6);

  const recommendedValue =
    recommendation?.dateKey === todayKey
      ? recommendation.time
      : visible[0]?.value;

  return visible.map((preset) => ({
    value: preset.value,
    label: formatTime12h(preset.value),
    period: preset.period,
    disabled: false,
    isRecommended: preset.value === recommendedValue,
    isDynamic: preset.isDynamic,
  }));
}
