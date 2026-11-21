"use client";

import { useComboBoxPagination } from "@/components/base-pagination";
import { request } from "@/components/http";
import {
  DeliveryScheduleFormData,
  DeliveryScheduleOrderDetail,
  DeliveryScheduleRow,
  SchedulingEntry,
  deliveryScheduleSchema,
  parseDeliveryCoordinates,
} from "@/schema/delivery-schedule";
import {
  SessionsAndLogsTableSchemaType,
  WsLogsTableSchemaType,
} from "@/schema/s&l";
import { DialogMode } from "@/types/dialog";
import { EstimateResponse } from "@/types/estimate";
import { useExpenseSettings } from "@/components/delivery-estimate-settings";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { format } from "date-fns";

type WarehouseOption = { id: number; name: string; latitude?: string | null; longitude?: string | null };
type DriverOption = { id: number; name: string; phone_number: string | null };
type VehicleOption = { id: number; plate_number: string; type: string; max_weight_kg?: string | null; max_volume_cbm?: string | null };
type SortedRoute = { locations: { id: string; name: string }[] };
type OptimizedRoute = {
  optimizedOrderIds: number[];
  originalDistanceKm: number;
  optimizedDistanceKm: number;
  savedDistanceKm: number;
  estimatedDurationMinutes: number | null;
  source: string;
};
type AvailableDate = { date: string; available_slots: number };
type ReadySelection = { groupId: string; label?: string } | { order: SchedulingEntry };
const readyOrdersPageSize = 10;

type SubType = {
  id?: number;
  is_open: boolean;
  mode: DialogMode;
};

type DeliveryScheduleType = {
  isStaff: boolean;
  removeSelection: (orderId: number) => void;
  startSchedule: (warehouseId?: number, orderIds?: number[]) => void;
  addReadyGroup: (groupId: string) => Promise<boolean>;
  addReadyOrders: (entries: SchedulingEntry[]) => Promise<boolean>;
  groupPending: boolean;
  availableStopSlots: number;
  deliveryScheduleQuery: ReturnType<
    typeof useQuery<{
      rows: SchedulingEntry[];
      total: number;
    }>
  >;
  form: ReturnType<typeof useForm<DeliveryScheduleFormData>>;
  page: { pageIndex: number; pageSize: number };
  setPage: Dispatch<SetStateAction<{ pageIndex: number; pageSize: number }>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;

  warehouseCB: ReturnType<typeof useComboBoxPagination>;
  orderCB: ReturnType<typeof useComboBoxPagination>;
  driverCB: ReturnType<typeof useComboBoxPagination>;
  vehicleCB: ReturnType<typeof useComboBoxPagination>;

  warehouseQuery: UseQueryResult<{
    rows: WarehouseOption[];
    total: number;
  }>;

  orderQuery: ReturnType<
    typeof useQuery<{
      rows: SchedulingEntry[];
      totalPages: number;
    }>
  >;

  orderDetailQuery: ReturnType<
    typeof useQuery<DeliveryScheduleOrderDetail[] | null>
  >;

  availableDateQuery: ReturnType<typeof useQuery<AvailableDate[]>>;

  driverQuery: ReturnType<
    typeof useQuery<{
      rows: DriverOption[];
      total: number;
    }>
  >;

  vehicleQuery: ReturnType<
    typeof useQuery<{
      rows: VehicleOption[];
      total: number;
    }>
  >;

  sub: SubType;
  setSub: Dispatch<SetStateAction<SubType>>;

  sortDistanceMutation: ReturnType<typeof useMutation<SortedRoute>>;
  optimizeRouteMutation: ReturnType<typeof useMutation<OptimizedRoute>>;

  expenseSettings: ReturnType<typeof useExpenseSettings>;
  driverExpensesMutation: ReturnType<typeof useMutation<EstimateResponse>>;
};

export const DeliveryScheduleContext =
  createContext<DeliveryScheduleType | null>(null);

export function useDeliverySchedule() {
  const context = useContext(DeliveryScheduleContext);

  if (!context) {
    throw new Error(
      "useDeliverySchedule must be used inside DeliveryScheduleProvider",
    );
  }

  return context;
}

export function DeliveryScheduleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userQuery } = useAuth();
  const isStaff = userQuery.data?.role === "staff";
  const expenseSettings = useExpenseSettings(true);
  const [groupPending, setGroupPending] = useState(false);
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 10 });
  const [search, setSearch] = useState("");
  const [step, setStep] = useState(0);

  const [sub, setSub] = useState<SubType>({
    id: -1,
    is_open: false,
    mode: DialogMode.DEFAULT,
  });

  const warehouseCB = useComboBoxPagination();
  const setWarehouseLabel = warehouseCB.setInputValue;
  const orderCB = useComboBoxPagination();
  const driverCB = useComboBoxPagination();
  const vehicleCB = useComboBoxPagination();

  const form = useForm<DeliveryScheduleFormData>({
    resolver: zodResolver(deliveryScheduleSchema),
    defaultValues: {
      warehouse_id: -1,
      order_ids: [],
      scheduled_date: undefined,
      scheduled_time: "",
      delivery_type: "INTERNAL",
      driver_id: -1,
      vehicle_id: -1,
      delivery_allowance: 0,
      fuel: 0,
      toll: 0,
    },
  });

  const order_ids = form.watch("order_ids");
  const warehouseId = form.watch("warehouse_id");
  const scheduledDate = form.watch("scheduled_date");

  const warehouseQuery = useQuery({
    queryKey: ["warehouses", "schedule-options", userQuery.data?.sub, warehouseCB.searchQuery],
    queryFn: async () => {
      const response = await fetch("/api/warehouses/names");
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Unable to load warehouses.");
      }
      return await response.json();
    },
    enabled: !!userQuery.data,
  });

  const assignedWarehouse = isStaff && !warehouseQuery.isError ? warehouseQuery.data?.rows[0] : undefined;
  useEffect(() => {
    if (!isStaff) return;
    const assignedId = assignedWarehouse?.id ?? -1;
    if (form.getValues("warehouse_id") !== assignedId) {
      form.setValue("warehouse_id", assignedId);
      form.setValue("order_ids", []);
      form.setValue("driver_id", -1);
      form.setValue("vehicle_id", -1);
    }
    setWarehouseLabel(assignedWarehouse?.name ?? "");
  }, [isStaff, assignedWarehouse?.id, assignedWarehouse?.name, form, setWarehouseLabel]);

  function startSchedule(warehouseId = -1, orderIds: number[] = []) {
    warehouseId = isStaff ? assignedWarehouse?.id ?? -1 : warehouseId;
    form.reset({ warehouse_id: warehouseId, order_ids: orderIds, scheduled_date: undefined,
      scheduled_time: "", delivery_type: "INTERNAL", driver_id: -1, vehicle_id: -1,
      delivery_allowance: 0, fuel: 0, toll: 0 });
    driverExpensesMutation.reset();
    setStep(0); setSub({ is_open: false, mode: DialogMode.DEFAULT });
    warehouseCB.setInputValue(warehouseQuery.data?.rows.find((row: WarehouseOption) => row.id === warehouseId)?.name ?? "");
    for (const picker of [orderCB, driverCB, vehicleCB]) {
      picker.setInputValue(""); picker.setSearchQuery(""); picker.setPage(0); picker.setOpen(false);
    }
  }

  const deliveryScheduleQuery = useQuery({
    queryKey: ["deliveryScheduleQuery", userQuery.data?.sub, page.pageIndex, page.pageSize, search],

    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", page.pageIndex.toString());
      url_params.append("limit", page.pageSize.toString());

      if (search && search.trim().length > 0) {
        url_params.append("search", search.trim());
      }

      const response = await fetch(
        `/api/delivery-schedules?${url_params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      return {
        rows: (await response.json()) as SchedulingEntry[],
        total: Number(response.headers.get("X-Total-Count") ?? 0),
      };
    },
  });

  const orderQuery = useQuery({
    queryKey: ["order", "scheduling", warehouseId, orderCB.page, orderCB.searchQuery],
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === warehouseId ? previous : undefined,
    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", orderCB.page.toString());
      url_params.append("limit", String(readyOrdersPageSize));

      if (orderCB.searchQuery.trim().length > 0) {
        url_params.append("search", orderCB.searchQuery);
      }

      url_params.append(
        "warehouse_id",
        warehouseId.toString(),
      );

      const response = await request("GET", `/api/delivery-schedules?${url_params.toString()}`);

      if (!response.ok) {
        throw new Error("Unable to load ready orders. Please retry.");
      }

      const total = Number(response.headers.get("X-Total-Count") ?? 0);
      return {
        rows: (await response.json()) as SchedulingEntry[],
        totalPages: Math.max(1, Math.ceil(total / readyOrdersPageSize)),
      };
    },

    enabled: step === 2 && warehouseId > 0 && sub.is_open && sub.mode === DialogMode.INSERT,
  });

  const orderDetailQuery = useQuery({
    queryKey: ["order_detail", order_ids],
    queryFn: async () => {
      if (!order_ids || order_ids.length === 0) return null;

      const response = await request(
        "GET",
        `/api/orders/details?ids=${order_ids.join(",")}`,
      );

      if (!response.ok) throw new Error("Unable to load selected orders. Please retry.");

      const rows = (await response.json()) as DeliveryScheduleOrderDetail[];
      const rowsById = new Map(rows.map((row) => [row.id, row]));

      return order_ids
        .map((orderId) => rowsById.get(orderId))
        .filter((row): row is DeliveryScheduleOrderDetail => row !== undefined);
    },
    enabled: order_ids.length > 0,
  });

  const availableDateQuery = useQuery({
    queryKey: ["availableDateQuery", warehouseId],

    queryFn: async () => {
      const response = await fetch(
        `/api/delivery-schedules/available-dates?warehouse_id=${warehouseId}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      return (await response.json()) as AvailableDate[];
    },

    enabled: warehouseId > 0,
  });

  const dateKey = scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : undefined;
  const availableStopSlots = availableDateQuery.data?.find((day) => day.date === dateKey)?.available_slots ?? 0;

  function removeSelection(orderId: number) {
    const selected = orderDetailQuery.data?.find(order => order.id === orderId);
    const groupIds = selected?.order_group_id
      ? new Set(orderDetailQuery.data?.filter(order => order.order_group_id === selected.order_group_id).map(order => order.id))
      : new Set([orderId]);
    form.setValue("order_ids", form.getValues("order_ids").filter(id => !groupIds.has(id)), { shouldDirty: true, shouldValidate: true });
  }

  async function addReadySelections(selections: ReadySelection[], stopLimit?: number) {
    if (groupPending || selections.length === 0) return false;
    setGroupPending(true);
    try {
      const warehouse = form.getValues("warehouse_id");
      const pendingIds: number[] = [];
      for (const selection of selections) {
        if ("order" in selection) {
          const { order } = selection;
          if (order.warehouse_id !== warehouse || !order.can_schedule ||
              !parseDeliveryCoordinates(order.shipping_latitude, order.shipping_longitude)) {
            throw new Error(`${order.order_number} needs a confirmed destination and must be ready in this warehouse.`);
          }
          pendingIds.push(order.id);
          continue;
        }
        const response = await request("GET", `/api/orders/groups/${selection.groupId}/ready?warehouse_id=${warehouse}`);
        const result = await response.json().catch(() => null);
        const label = selection.label ?? result?.group_number ?? "Order group";
        if (!response.ok) throw new Error(`${label}. ${result?.message || "Unable to load this order group."}`);
        const rows = result?.rows as Pick<DeliveryScheduleRow, "id" | "shipping_latitude" | "shipping_longitude">[] | undefined;
        if (!rows?.length) throw new Error(`${label} has no ready orders in this warehouse.`);
        if (rows.some((row) => !parseDeliveryCoordinates(row.shipping_latitude, row.shipping_longitude))) {
          throw new Error(`Confirm every destination in ${label} before adding the group.`);
        }
        pendingIds.push(...rows.map((row) => row.id));
      }
      if (warehouse !== form.getValues("warehouse_id")) return false;
      const currentIds = form.getValues("order_ids");
      const ids = [...new Set([...currentIds, ...pendingIds])];
      if (stopLimit !== undefined && ids.length > stopLimit) {
        throw new Error(`The selected date has ${stopLimit} available stops. Adjust your selection or choose another date.`);
      }
      form.setValue("order_ids", ids, { shouldDirty: true, shouldValidate: true });
      form.clearErrors("root");
      const added = ids.length - currentIds.length;
      if (added > 0) toast.success(`Added ${added} ${added === 1 ? "order" : "orders"} to the delivery.`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add the selected orders.");
      return false;
    } finally {
      setGroupPending(false);
    }
  }

  function addReadyGroup(groupId: string) {
    return addReadySelections([{ groupId }]);
  }

  function addReadyOrders(entries: SchedulingEntry[]) {
    return addReadySelections(entries.map((order) => order.order_group_id
      ? { groupId: order.order_group_id, label: order.order_group_number ?? undefined }
      : { order }), availableStopSlots);
  }

  const driverQuery = useQuery({
    queryKey: ["drivers", "scheduling", warehouseId, driverCB.page, driverCB.searchQuery],
    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", driverCB.page.toString());
      url_params.append("limit", "10");

      if (driverCB.searchQuery.trim().length > 0) {
        url_params.append("search", driverCB.searchQuery);
      }

      url_params.append(
        "warehouse_id",
        warehouseId.toString(),
      );

      const response = await fetch(
        `/api/users/drivers?${url_params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch drivers");
      }

      const result = await response.json();

      driverCB.setTotalPages(Math.ceil(result.total / 10));

      return result;
    },

    enabled: step === 3 && warehouseId > 0,
  });

  const vehicleQuery = useQuery({
    queryKey: ["vehicles", "scheduling", warehouseId, vehicleCB.page, vehicleCB.searchQuery],
    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", vehicleCB.page.toString());
      url_params.append("limit", "10");

      if (vehicleCB.searchQuery.trim().length > 0) {
        url_params.append("search", vehicleCB.searchQuery);
      }

      url_params.append(
        "warehouse_id",
        warehouseId.toString(),
      );

      const response = await fetch(`/api/vehicles/cb?${url_params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch drivers");
      }

      const result = await response.json();

      vehicleCB.setTotalPages(Math.ceil(result.total / 10));

      return result;
    },

    enabled: step === 3 && warehouseId > 0,
  });

  const sortDistanceMutation = useMutation({
    mutationFn: async () => {
      const warehouse_id = form.getValues("warehouse_id");

      const warehouse_data = warehouseQuery.data?.rows.find(
        (warehouse: WarehouseOption) => warehouse.id === warehouse_id,
      );

      const locations: {
        id: string;
        name: string;
        lat: number;
        lng: number;
      }[] = [];

      for (const order_id of order_ids) {
        const orderDetail = orderDetailQuery.data?.find(
          (order: DeliveryScheduleOrderDetail) => order.id === order_id,
        );

        if (orderDetail) {
          locations.push({
            id: String(orderDetail.id),
            name: String(orderDetail.order_number),
            lat: Number(orderDetail.shipping_latitude),
            lng: Number(orderDetail.shipping_longitude),
          });
        }
      }

      const response = await fetch("/api/fleet/coordinates/sort", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: {
            lat: Number(warehouse_data?.latitude) || 0,
            lng: Number(warehouse_data?.longitude) || 0,
          },
          locations: locations,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result?.errors) {
          throw new Error(JSON.stringify(result));
        }

        throw new Error("Unable to calculate the route. Please retry.");
      }

      return result;
    },

    onError: (error) => toast.error(error.message),
    onSuccess: async (result: SortedRoute) => {
      const new_order_ids: number[] = result.locations.map((location: SortedRoute["locations"][number]) =>
        Number(location.id),
      );

      toast.success(
        `Sorted ${result.locations.map((location: SortedRoute["locations"][number]) => location.name).join(", ")} orders by distance from warehouse`,
        {
          duration: 4000,
        },
      );

      form.setValue("order_ids", new_order_ids);
    },
  });

  const optimizeRouteMutation = useMutation({
    mutationFn: async () => {
      const warehouse_id = form.getValues("warehouse_id");
      const warehouse_data = warehouseQuery.data?.rows.find(
        (warehouse: WarehouseOption) => warehouse.id === warehouse_id,
      );
      const origin = parseDeliveryCoordinates(
        warehouse_data?.latitude,
        warehouse_data?.longitude,
      );
      if (!origin) {
        throw new Error("Warehouse coordinates are required before optimizing the route.");
      }
      const stops: { orderId: number; latitude: number; longitude: number }[] = [];
      for (const order_id of order_ids) {
        const detail = orderDetailQuery.data?.find(
          (order: DeliveryScheduleOrderDetail) => order.id === order_id,
        );
        const point = parseDeliveryCoordinates(
          detail?.shipping_latitude,
          detail?.shipping_longitude,
        );
        if (!detail || !point) {
          throw new Error(
            `Confirm destination coordinates for ${detail?.order_number ?? `order #${order_id}`} before optimizing.`,
          );
        }
        stops.push({ orderId: detail.id, longitude: point[0], latitude: point[1] });
      }
      const response = await request("POST", "/api/delivery-estimates/optimize-route", {
        origin: { longitude: origin[0], latitude: origin[1] },
        stops,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || "Unable to optimize route.");
      }
      return result as OptimizedRoute;
    },
    onError: (error) => toast.error(error.message),
    onSuccess: (result: OptimizedRoute) => {
      form.setValue("order_ids", result.optimizedOrderIds, {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast.success(
        result.savedDistanceKm > 0
          ? `Route optimized via ${result.source} — saved ~${result.savedDistanceKm.toFixed(1)} km`
          : `Stop order optimized via ${result.source} (${result.optimizedDistanceKm.toFixed(1)} km)`,
        { duration: 4000 },
      );
    },
  });

  const driverExpensesMutation = useMutation({
    mutationFn: async () => {
      const warehouse = warehouseQuery.data?.rows.find((row: WarehouseOption) => row.id === form.getValues("warehouse_id"));
      const coordinate = (latitude: string | null | undefined, longitude: string | null | undefined, label: string) => {
        const point = parseDeliveryCoordinates(latitude, longitude);
        if (!point) throw new Error(`Confirm the coordinates for ${label} before calculating the driving route.`);
        return { longitude: point[0], latitude: point[1] };
      };
      const points = [coordinate(warehouse?.latitude, warehouse?.longitude, "the warehouse")];
      if (!order_ids.length) throw new Error("Select at least one delivery order.");
      for (const order_id of order_ids) {
        const order = orderDetailQuery.data?.find(order => order.id === order_id);
        if (!order) throw new Error("Order destinations are still loading. Please retry.");
        points.push(coordinate(order.shipping_latitude, order.shipping_longitude, order.order_number));
      }
      if (points.length > 26) throw new Error("Google supports up to 25 delivery stops per estimate.");

      const response = await fetch("/api/delivery-estimates", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          points,
          ...expenseSettings.requestOptions(),
          isRoundTrip: true,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || "Unable to calculate expenses. Please retry.");

      return result;
    },

    onError: (error) => toast.error(error.message),
    onSuccess: async (estimate: EstimateResponse) => {
      form.setValue(
        "delivery_allowance",
        Math.round(estimate.expenses.driverAllowance * 100) / 100,
      );
      form.setValue(
        "fuel",
        Math.round(estimate.expenses.estimatedFuelCost * 100) / 100,
      );
      form.setValue("toll", estimate.expenses.estimatedTollFee === null ? Number.NaN : Math.round(estimate.expenses.estimatedTollFee * 100) / 100);
      if (estimate.expenses.estimatedTollFee === null) toast.warning("Toll price unavailable. Enter the toll amount before scheduling.");
    },
  });

  const routeWarehouse = warehouseQuery.data?.rows.find((row: WarehouseOption) => row.id === warehouseId);
  const routeKey = JSON.stringify([
    warehouseId, routeWarehouse?.latitude, routeWarehouse?.longitude, order_ids,
    orderDetailQuery.data?.map((order) => [order.shipping_latitude, order.shipping_longitude]),
  ]);
  const resetDriverExpenses = driverExpensesMutation.reset;
  useEffect(() => {
    resetDriverExpenses();
  }, [routeKey, resetDriverExpenses]);

  return (
    <DeliveryScheduleContext.Provider
      value={{
        isStaff,
        removeSelection, startSchedule, addReadyGroup, addReadyOrders, groupPending, availableStopSlots,
        deliveryScheduleQuery,
        form,
        page,
        setPage,
        search,
        setSearch,
        step,
        setStep,
        warehouseCB,
        orderCB,
        driverCB,
        vehicleCB,
        warehouseQuery,
        orderQuery,
        orderDetailQuery,
        availableDateQuery,
        driverQuery,
        vehicleQuery,
        sub,
        setSub,
        sortDistanceMutation,
        optimizeRouteMutation,
        driverExpensesMutation,
        expenseSettings,
      }}
    >
      {children}
    </DeliveryScheduleContext.Provider>
  );
}
