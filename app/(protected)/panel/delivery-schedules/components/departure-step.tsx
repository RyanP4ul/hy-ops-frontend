"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { format, startOfDay } from "date-fns";
import { AlertTriangle, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryFeedback } from "@/components/query-feedback";
import { cn } from "@/lib/utils";
import {
  formatTime12h,
  getDepartureTimePresets,
  getQuickDateOptions,
  getRecommendedDeparture,
} from "@/lib/departure-recommendations";
import { isFutureManilaDeparture, manilaCalendarNow } from "@/utils/date-util";
import { useDeliverySchedule } from "../provider";

export function DepartureStep() {
  const { form, availableDateQuery, availableStopSlots } = useDeliverySchedule();
  const [nowInstant, setNowInstant] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowInstant(new Date());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedDate = useWatch({ control: form.control, name: "scheduled_date" });
  const selectedTime = useWatch({ control: form.control, name: "scheduled_time" });
  const draftOrderIds = useWatch({ control: form.control, name: "order_ids" }) ?? [];

  const requiredStops = Math.max(1, draftOrderIds.length);
  const manilaTodayStart = useMemo(
    () => startOfDay(manilaCalendarNow(nowInstant)),
    [nowInstant],
  );

  const availableDates = availableDateQuery.data;
  const availableDateMap = useMemo(
    () => new Map((availableDates ?? []).map((item) => [item.date, item])),
    [availableDates],
  );

  const recommendation = useMemo(
    () => getRecommendedDeparture(availableDates, requiredStops, nowInstant),
    [availableDates, requiredStops, nowInstant],
  );

  const quickDates = useMemo(
    () =>
      getQuickDateOptions(
        availableDates,
        recommendation,
        requiredStops,
        nowInstant,
        4,
      ),
    [availableDates, recommendation, requiredStops, nowInstant],
  );

  const selectedDateKey = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : undefined;

  const timePresets = useMemo(
    () => getDepartureTimePresets(selectedDateKey, recommendation, nowInstant),
    [selectedDateKey, recommendation, nowInstant],
  );

  const isRecommendedApplied = Boolean(
    recommendation &&
      selectedDateKey === recommendation.dateKey &&
      selectedTime === recommendation.time,
  );

  const isPastSelection = Boolean(
    selectedDateKey &&
      selectedTime &&
      !isFutureManilaDeparture(selectedDateKey, selectedTime, nowInstant.getTime()),
  );

  const slotsReady = availableDateQuery.isSuccess;
  const hasInsufficientSlots = Boolean(
    selectedDate &&
      slotsReady &&
      (availableStopSlots < 1 || draftOrderIds.length > availableStopSlots),
  );

  function applyRecommendation() {
    if (!recommendation) return;
    form.setValue("scheduled_date", recommendation.date, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("scheduled_time", recommendation.time, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.clearErrors(["scheduled_date", "scheduled_time"]);
  }

  function selectDate(date: Date | undefined) {
    form.setValue("scheduled_date", date as Date, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (date) {
      form.clearErrors("scheduled_date");
    }
  }

  function selectTime(time: string) {
    form.setValue("scheduled_time", time, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.clearErrors("scheduled_time");
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Departure dates and times use Asia/Manila.
      </p>

      <QueryFeedback
        query={availableDateQuery}
        label="available schedule dates"
      />

      {/* Compact Recommended Departure Strip */}
      {availableDateQuery.isPending ? (
        <div
          aria-busy="true"
          className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3"
        >
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ) : recommendation ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors",
            isRecommendedApplied
              ? "border-primary/30 bg-primary/[0.05]"
              : "bg-muted/25",
          )}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Recommended
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {recommendation.isToday
                ? `Today, ${format(recommendation.date, "MMM d")}`
                : recommendation.isTomorrow
                  ? `Tomorrow, ${format(recommendation.date, "MMM d")}`
                  : format(recommendation.date, "EEE, MMM d")}{" "}
              · {formatTime12h(recommendation.time)}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({recommendation.availableSlots}{" "}
                {recommendation.availableSlots === 1 ? "slot" : "slots"})
              </span>
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant={isRecommendedApplied ? "secondary" : "default"}
            aria-pressed={isRecommendedApplied}
            onClick={applyRecommendation}
            className="shrink-0"
          >
            {isRecommendedApplied ? "Applied" : "Use"}
          </Button>
        </div>
      ) : (
        !availableDateQuery.isError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>No open delivery dates available in the next 30 days.</span>
          </div>
        )
      )}

      {/* Date & Time Inputs */}
      <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <legend className="sr-only">Delivery date and departure time</legend>

        <Controller
          control={form.control}
          name="scheduled_date"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-2">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="scheduledDate">
                  Delivery Date{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </FieldLabel>
                {selectedDate && slotsReady && (
                  <span
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      hasInsufficientSlots
                        ? "text-destructive"
                        : "text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    {availableStopSlots}{" "}
                    {availableStopSlots === 1 ? "slot" : "slots"} left
                  </span>
                )}
              </div>

              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      id="scheduledDate"
                      type="button"
                      variant="outline"
                      aria-invalid={fieldState.invalid}
                      className={cn(
                        "min-h-10 w-full justify-between px-3 font-normal text-base sm:text-sm",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      <span className="truncate">
                        {field.value
                          ? format(field.value, "EEE, MMM d, yyyy")
                          : "Select date"}
                      </span>
                      <ChevronDownIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Button>
                  }
                />

                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    defaultMonth={
                      field.value ?? recommendation?.date ?? manilaTodayStart
                    }
                    onSelect={(date) => {
                      field.onChange(date);
                      if (date) form.clearErrors("scheduled_date");
                    }}
                    disabled={[
                      { before: manilaTodayStart },
                      (date) => {
                        const key = format(date, "yyyy-MM-dd");
                        const day = availableDateMap.get(key);
                        return !day || day.available_slots < 1;
                      },
                    ]}
                  />
                </PopoverContent>
              </Popover>

              {quickDates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {quickDates.map((option) => {
                    const isSelected = selectedDateKey === option.dateKey;
                    const label =
                      option.relativeLabel === "Today" ||
                      option.relativeLabel === "Tomorrow"
                        ? option.relativeLabel
                        : `${option.relativeLabel}, ${option.shortDateLabel}`;
                    return (
                      <button
                        key={option.dateKey}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => selectDate(option.date)}
                        className={cn(
                          "min-h-8 rounded-lg border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-muted",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="scheduled_time"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-2">
              <FieldLabel htmlFor="scheduled_time">
                Departure Time{" "}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </FieldLabel>

              <Input
                {...field}
                id="scheduled_time"
                type="time"
                step="60"
                enterKeyHint="next"
                required
                aria-invalid={fieldState.invalid}
                className="min-h-10 text-base tabular-nums sm:text-sm"
                onChange={(event) => {
                  field.onChange(event);
                  form.clearErrors("scheduled_time");
                }}
              />

              {timePresets.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {timePresets.map((preset) => {
                    const isSelected = field.value === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        disabled={preset.disabled}
                        aria-pressed={isSelected}
                        onClick={() => selectTime(preset.value)}
                        className={cn(
                          "min-h-8 rounded-lg border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-muted",
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No times left today. Choose another date.
                </p>
              )}

              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </fieldset>

      {/* Only show a banner when action is needed */}
      {(hasInsufficientSlots || isPastSelection) && selectedDate && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-950 dark:text-amber-200"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle
              className="size-4 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden="true"
            />
            {hasInsufficientSlots
              ? availableStopSlots < 1
                ? "No stop slots left on this date."
                : `Only ${availableStopSlots} ${availableStopSlots === 1 ? "slot" : "slots"} left for ${draftOrderIds.length} selected orders.`
              : "This departure time has already passed in Manila."}
          </span>

          {isPastSelection && timePresets[0] && !timePresets[0].disabled && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => selectTime(timePresets[0].value)}
            >
              Use {timePresets[0].label}
            </Button>
          )}
          {hasInsufficientSlots &&
            recommendation &&
            recommendation.dateKey !== selectedDateKey && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={applyRecommendation}
              >
                Switch to {format(recommendation.date, "MMM d")}
              </Button>
            )}
        </div>
      )}
    </div>
  );
}
