"use client";

import {
  CalendarEventResponse,
  CalendarForm,
  CalendarFormType,
} from "@/schema/calendar";
import type { DeliveryCalendarEntry } from "@/schema/delivery-calendar";
import { deliveryCalendarEvent } from "@/lib/delivery-calendar";
import { request } from "@/components/http";
import { manilaCalendarNow, parseLocalDateTime } from "@/utils/date-util";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns/addDays";
import { eachDayOfInterval } from "date-fns/eachDayOfInterval";
import { startOfWeek } from "date-fns/startOfWeek";
import { createContext, useContext, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

type SelectedType = {
  id: number;
  version: number;
};

type CalendarContext = {
  calendar_form: ReturnType<typeof useForm<CalendarFormType>>;
  deliveryQuery: ReturnType<typeof useQuery<DeliveryCalendarEntry[]>>;
  eventQuery: ReturnType<typeof useQuery<CalendarEventResponse[]>>;
  filteredEvents: CalendarEventResponse[];
  view: CalendarViewMode;
  setView: React.Dispatch<React.SetStateAction<CalendarViewMode>>;
  selectedDate: Date;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
  calendarDays: Date[];
  selectedCategories: CalendarCategory[];
  setSelectedCategories: React.Dispatch<
    React.SetStateAction<CalendarCategory[]>
  >;
  selected: SelectedType;
  setSelected: React.Dispatch<React.SetStateAction<SelectedType>>;
};

const CalendarContext = createContext<CalendarContext | null>(null);

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context)
    throw new Error("useCalendar must be used inside CalendarProvider");
  return context;
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<SelectedType>({
    id: -1,
    version: -1,
  });
  const [selectedCategories, setSelectedCategories] = useState<
    CalendarCategory[]
  >([]);

  const calendar_form = useForm<CalendarFormType>({
    resolver: zodResolver(CalendarForm),
    defaultValues: {
      title: "",
      category: "",
      date: undefined,
      start_time: undefined,
      end_time: undefined,
    },
  });

  const [view, setView] = useState<CalendarViewMode>("Week");

  const [selectedDate, setSelectedDate] = useState<Date>(() => manilaCalendarNow());

  const weekStart = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 1 }),
    [selectedDate],
  );

  const calendarDays = useMemo(() => {
    if (view === "Day") return [selectedDate];
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  }, [selectedDate, view, weekStart]);

  const eventQuery = useQuery({
    queryKey: ["event_query"],
    queryFn: async () => {
      const response = await fetch("/api/calendar/events");

      if (!response.ok) {
        throw new Error("Failed to fetch calendar events");
      }

      const result = (await response.json()) as CalendarFormType[];

      return result.map((event) => ({
        ...event,
        date: parseLocalDateTime(event.date, "00:00"),
        start_time: parseLocalDateTime(event.date, event.start_time),
        end_time: parseLocalDateTime(event.date, event.end_time),
      })) as CalendarEventResponse[];
    },
  });

  const deliveryQuery = useQuery<DeliveryCalendarEntry[]>({
    queryKey: ["delivery-calendar"],
    queryFn: async () => {
      const response = await request("GET", "/api/deliveries/calendar");
      if (!response.ok) throw new Error("Unable to load deliveries.");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const filteredEvents = useMemo(
    () =>
      [...(eventQuery.data ?? []), ...(deliveryQuery.data ?? []).map(deliveryCalendarEvent)].filter(
        (event) =>
          selectedCategories.length === 0 ||
          selectedCategories.includes(event.category as CalendarCategory),
      ),
    [eventQuery.data, deliveryQuery.data, selectedCategories],
  );

  return (
    <CalendarContext.Provider
      value={{
        calendar_form,
        eventQuery,
        deliveryQuery,
        filteredEvents,
        view,
        setView,
        selectedDate,
        setSelectedDate,
        calendarDays,
        selectedCategories,
        setSelectedCategories,
        selected,
        setSelected,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}
