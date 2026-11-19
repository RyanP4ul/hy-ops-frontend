"use client";

import {
  CalendarEventResponse,
  CalendarForm,
  CalendarFormType,
} from "@/schema/calendar";
import type { DeliveryCalendarEntry } from "@/schema/delivery-calendar";
import {
  deliveryCalendarEvent,
  getDeliveryEffectiveStatus,
  getDeliveryStopStats,
  type DeliveryEffectiveStatus,
} from "@/lib/delivery-calendar";
import { request } from "@/components/http";
import { manilaCalendarNow, parseLocalDateTime } from "@/utils/date-util";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useForm } from "react-hook-form";

type SelectedType = {
  id: number;
  version: number;
};

export type DeliveryStatusFilter = "all" | DeliveryEffectiveStatus;

export type DailyDeliverySummary = {
  runs: number;
  stops: number;
  pickups: number;
  overdue: number;
  inTransit: number;
};

export type DeliveryPeriodSummary = {
  totalRuns: number;
  activeRuns: number;
  totalStops: number;
  deliveredStops: number;
  failedStops: number;
  pickups: number;
  byStatus: Record<DeliveryEffectiveStatus, number>;
};

type CalendarContextValue = {
  calendar_form: ReturnType<typeof useForm<CalendarFormType>>;
  deliveryQuery: ReturnType<typeof useQuery<DeliveryCalendarEntry[]>>;
  eventQuery: ReturnType<typeof useQuery<CalendarEventResponse[]>>;
  filteredDeliveries: DeliveryCalendarEntry[];
  filteredEvents: CalendarEventResponse[];
  visibleEvents: CalendarEventResponse[];
  visibleDeliveries: DeliveryCalendarEntry[];
  periodSummary: DeliveryPeriodSummary;
  dailyDeliveryStats: Map<string, DailyDeliverySummary>;
  warehouses: { id: number; name: string }[];
  view: CalendarViewMode;
  setView: React.Dispatch<React.SetStateAction<CalendarViewMode>>;
  selectedDate: Date;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
  calendarDays: Date[];
  now: Date;
  nowMs: number;
  selectedCategories: CalendarCategory[];
  setSelectedCategories: React.Dispatch<
    React.SetStateAction<CalendarCategory[]>
  >;
  statusFilter: DeliveryStatusFilter;
  setStatusFilter: React.Dispatch<React.SetStateAction<DeliveryStatusFilter>>;
  warehouseFilter: string;
  setWarehouseFilter: React.Dispatch<React.SetStateAction<string>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  hideCancelled: boolean;
  setHideCancelled: React.Dispatch<React.SetStateAction<boolean>>;
  deliveriesOnly: boolean;
  setDeliveriesOnly: React.Dispatch<React.SetStateAction<boolean>>;
  hasActiveFilters: boolean;
  resetFilters: () => void;
  selected: SelectedType;
  setSelected: React.Dispatch<React.SetStateAction<SelectedType>>;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context)
    throw new Error("useCalendar must be used inside CalendarProvider");
  return context;
}

function matchesDeliverySearch(
  delivery: DeliveryCalendarEntry,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  const haystacks = [
    `#${delivery.id}`,
    `delivery #${delivery.id}`,
    String(delivery.id),
    delivery.driver,
    delivery.vehicle,
    delivery.warehouse,
    delivery.status.replaceAll("_", " "),
    ...delivery.orders.flatMap((order) => [
      order.orderNumber,
      order.recipient ?? "",
      order.address ?? "",
    ]),
  ];
  return haystacks.some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<SelectedType>({
    id: -1,
    version: -1,
  });
  const [selectedCategories, setSelectedCategories] = useState<
    CalendarCategory[]
  >([]);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatusFilter>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hideCancelled, setHideCancelled] = useState<boolean>(false);
  const [deliveriesOnly, setDeliveriesOnly] = useState<boolean>(false);

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
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    manilaCalendarNow(),
  );
  const [clock, setClock] = useState(() => ({
    manilaNow: manilaCalendarNow(),
    nowMs: Date.now(),
  }));

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClock({
        manilaNow: manilaCalendarNow(),
        nowMs: Date.now(),
      });
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const weekStart = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 1 }),
    [selectedDate],
  );

  const calendarDays = useMemo(() => {
    if (view === "Day") return [selectedDate];
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  }, [selectedDate, view, weekStart]);

  const visibleRange = useMemo(() => {
    if (view === "Day") {
      return {
        start: startOfDay(selectedDate),
        endExclusive: startOfDay(addDays(selectedDate, 1)),
      };
    }
    if (view === "Month") {
      return {
        start: startOfMonth(selectedDate),
        endExclusive: startOfMonth(addMonths(selectedDate, 1)),
      };
    }
    // Both Week and Agenda scope to the active Mon–Sun week
    const firstDay =
      calendarDays[0] ?? startOfWeek(selectedDate, { weekStartsOn: 1 });
    const lastDay =
      calendarDays[calendarDays.length - 1] ??
      endOfWeek(selectedDate, { weekStartsOn: 1 });
    return {
      start: startOfDay(firstDay),
      endExclusive: startOfDay(addDays(lastDay, 1)),
    };
  }, [calendarDays, selectedDate, view]);

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

  const warehouses = useMemo(() => {
    const map = new Map<number, string>();
    for (const delivery of deliveryQuery.data ?? []) {
      if (!map.has(delivery.warehouseId)) {
        map.set(delivery.warehouseId, delivery.warehouse);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [deliveryQuery.data]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const deliveriesWithoutStatusFilter = useMemo(() => {
    const allowsDeliveryCategory =
      selectedCategories.length === 0 ||
      selectedCategories.includes("DELIVERY");
    if (!allowsDeliveryCategory) return [];

    return (deliveryQuery.data ?? []).filter((delivery) => {
      if (
        warehouseFilter !== "all" &&
        String(delivery.warehouseId) !== warehouseFilter
      ) {
        return false;
      }
      if (hideCancelled && delivery.status === "cancelled") {
        return false;
      }
      return matchesDeliverySearch(delivery, normalizedQuery);
    });
  }, [
    deliveryQuery.data,
    hideCancelled,
    normalizedQuery,
    selectedCategories,
    warehouseFilter,
  ]);

  const filteredDeliveries = useMemo(() => {
    if (statusFilter === "all") return deliveriesWithoutStatusFilter;
    return deliveriesWithoutStatusFilter.filter((delivery) => {
      const effective = getDeliveryEffectiveStatus(delivery, clock.nowMs);
      if (statusFilter === "scheduled") {
        return delivery.status === "scheduled";
      }
      return effective === statusFilter;
    });
  }, [clock.nowMs, deliveriesWithoutStatusFilter, statusFilter]);

  const filteredManualEvents = useMemo(() => {
    if (
      deliveriesOnly ||
      statusFilter !== "all" ||
      warehouseFilter !== "all"
    ) {
      return [];
    }
    return (eventQuery.data ?? []).filter((event) => {
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(event.category as CalendarCategory)
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        event.title.toLowerCase().includes(normalizedQuery) ||
        event.category.replaceAll("_", " ").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [
    deliveriesOnly,
    eventQuery.data,
    normalizedQuery,
    selectedCategories,
    statusFilter,
    warehouseFilter,
  ]);

  const filteredEvents = useMemo(
    () => [
      ...filteredManualEvents,
      ...filteredDeliveries.map(deliveryCalendarEvent),
    ],
    [filteredDeliveries, filteredManualEvents],
  );

  const visibleEvents = useMemo(
    () =>
      filteredEvents.filter(
        (event) =>
          event.end_time > visibleRange.start &&
          event.start_time < visibleRange.endExclusive,
      ),
    [filteredEvents, visibleRange],
  );

  const visibleDeliveries = useMemo(
    () =>
      filteredDeliveries.filter((delivery) => {
        const start = parseLocalDateTime(delivery.date, delivery.start_time);
        const end = new Date(start.getTime() + 1);
        return end > visibleRange.start && start < visibleRange.endExclusive;
      }),
    [filteredDeliveries, visibleRange],
  );

  const periodSummary = useMemo<DeliveryPeriodSummary>(() => {
    const byStatus: Record<DeliveryEffectiveStatus, number> = {
      scheduled: 0,
      overdue: 0,
      in_transit: 0,
      returning: 0,
      completed: 0,
      cancelled: 0,
    };
    let totalRuns = 0;
    let activeRuns = 0;
    let totalStops = 0;
    let deliveredStops = 0;
    let failedStops = 0;
    let pickups = 0;

    // Scope KPIs to warehouse + search + visible date range (independent of statusFilter
    // so users can toggle between KPI filter chips effortlessly).
    for (const delivery of deliveryQuery.data ?? []) {
      if (
        warehouseFilter !== "all" &&
        String(delivery.warehouseId) !== warehouseFilter
      ) {
        continue;
      }
      if (!matchesDeliverySearch(delivery, normalizedQuery)) continue;

      const start = parseLocalDateTime(delivery.date, delivery.start_time);
      const end = new Date(start.getTime() + 1);
      if (end <= visibleRange.start || start >= visibleRange.endExclusive) {
        continue;
      }

      const effective = getDeliveryEffectiveStatus(delivery, clock.nowMs);
      byStatus[effective] += 1;
      if (effective === "overdue") {
        // Also count toward total scheduled runs that still need attention.
        byStatus.scheduled += 1;
      }

      if (delivery.status !== "cancelled") {
        totalRuns += 1;
        const stats = getDeliveryStopStats(delivery);
        totalStops += stats.total;
        deliveredStops += stats.delivered;
        failedStops += stats.failed;
        pickups += stats.pickups;
      }

      if (
        delivery.status === "scheduled" ||
        delivery.status === "in_transit" ||
        delivery.status === "returning"
      ) {
        activeRuns += 1;
      }
    }

    return {
      totalRuns,
      activeRuns,
      totalStops,
      deliveredStops,
      failedStops,
      pickups,
      byStatus,
    };
  }, [
    clock.nowMs,
    deliveryQuery.data,
    normalizedQuery,
    visibleRange,
    warehouseFilter,
  ]);

  const dailyDeliveryStats = useMemo(() => {
    const map = new Map<string, DailyDeliverySummary>();
    for (const delivery of deliveryQuery.data ?? []) {
      if (delivery.status === "cancelled") continue;
      if (
        warehouseFilter !== "all" &&
        String(delivery.warehouseId) !== warehouseFilter
      ) {
        continue;
      }
      const key = delivery.date;
      const existing = map.get(key) ?? {
        runs: 0,
        stops: 0,
        pickups: 0,
        overdue: 0,
        inTransit: 0,
      };
      const effective = getDeliveryEffectiveStatus(delivery, clock.nowMs);
      existing.runs += 1;
      existing.stops += delivery.orders.length;
      existing.pickups += delivery.pickupCount;
      if (effective === "overdue") existing.overdue += 1;
      if (delivery.status === "in_transit" || delivery.status === "returning") {
        existing.inTransit += 1;
      }
      map.set(key, existing);
    }
    return map;
  }, [clock.nowMs, deliveryQuery.data, warehouseFilter]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    warehouseFilter !== "all" ||
    normalizedQuery.length > 0 ||
    hideCancelled ||
    deliveriesOnly ||
    selectedCategories.length > 0;

  function resetFilters() {
    setStatusFilter("all");
    setWarehouseFilter("all");
    setSearchQuery("");
    setHideCancelled(false);
    setDeliveriesOnly(false);
    setSelectedCategories([]);
  }

  return (
    <CalendarContext.Provider
      value={{
        calendar_form,
        eventQuery,
        deliveryQuery,
        filteredDeliveries,
        filteredEvents,
        visibleEvents,
        visibleDeliveries,
        periodSummary,
        dailyDeliveryStats,
        warehouses,
        view,
        setView,
        selectedDate,
        setSelectedDate,
        calendarDays,
        now: clock.manilaNow,
        nowMs: clock.nowMs,
        selectedCategories,
        setSelectedCategories,
        statusFilter,
        setStatusFilter,
        warehouseFilter,
        setWarehouseFilter,
        searchQuery,
        setSearchQuery,
        hideCancelled,
        setHideCancelled,
        deliveriesOnly,
        setDeliveriesOnly,
        hasActiveFilters,
        resetFilters,
        selected,
        setSelected,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}
