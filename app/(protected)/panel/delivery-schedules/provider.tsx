"use client";

import { useComboBoxPagination } from "@/components/base-pagination";
import { request } from "@/components/http";
import {
  DeliveryScheduleFormData,
  OrderGroupFields,
  DeliveryScheduleOrderDetail,
  DeliveryScheduleRow,
  SchedulingEntry,
  deliveryScheduleSchema,
} from "@/schema/delivery-schedule";
import {
  SessionsAndLogsTableSchemaType,
  WsLogsTableSchemaType,
} from "@/schema/s&l";
import { DialogMode } from "@/types/dialog";
import { EstimateResponse } from "@/types/estimate";
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

type WarehouseOption = { id: number; name: string; latitude?: string | null; longitude?: string | null };
type DriverOption = { id: number; name: string; phone_number: string | null };
type VehicleOption = { id: number; plate_number: string; type: string };
type SortedRoute = { locations: { id: string; name: string }[] };

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
  groupPending: boolean;
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
      total: number;
    }>
  >;

  orderDetailQuery: ReturnType<
    typeof useQuery<DeliveryScheduleOrderDetail[] | null>
  >;

  availableDateQuery: ReturnType<
    typeof useQuery<
      {
        date: string;
        available_slots: number;
      }[]
    >
  >;

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
    queryFn: async () => {
      const url_params = new URLSearchParams();

      url_params.append("page", orderCB.page.toString());
      url_params.append("limit", "10");

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

      const result = { rows: await response.json(), total: Number(response.headers.get("X-Total-Count") ?? 0) };

      orderCB.setTotalPages(Math.ceil(result.total / 10));

      return result;
    },

    enabled: step === 2 && warehouseId > 0,
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

      return await response.json();
    },

    enabled: warehouseId > 0,
  });

  function removeSelection(orderId: number) {
    const selected = orderDetailQuery.data?.find(order => order.id === orderId);
    const groupIds = selected?.order_group_id
      ? new Set(orderDetailQuery.data?.filter(order => order.order_group_id === selected.order_group_id).map(order => order.id))
      : new Set([orderId]);
    form.setValue("order_ids", form.getValues("order_ids").filter(id => !groupIds.has(id)), { shouldDirty: true, shouldValidate: true });
  }

  async function addReadyGroup(groupId: string) {
    if (groupPending) return false;
    setGroupPending(true);
    try {
      const warehouse = form.getValues("warehouse_id");
      const response = await request("GET", `/api/orders/groups/${groupId}/ready?warehouse_id=${warehouse}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load this order group.");
      const rows = result.rows as (OrderGroupFields & { id: number; shipping_latitude: string | null; shipping_longitude: string | null })[];
      if (!rows.length) throw new Error("This group has no ready orders in this warehouse.");
      if (rows.some(row => row.shipping_latitude == null || row.shipping_longitude == null ||
        !Number.isFinite(Number(row.shipping_latitude)) || !Number.isFinite(Number(row.shipping_longitude)) ||
        Math.abs(Number(row.shipping_latitude)) > 90 || Math.abs(Number(row.shipping_longitude)) > 180 ||
        (Number(row.shipping_latitude) === 0 && Number(row.shipping_longitude) === 0))) {
        throw new Error("Confirm destination coordinates for every order in this group before adding it.");
      }
      if (warehouse !== form.getValues("warehouse_id")) return false;
      const ids = [...new Set([...form.getValues("order_ids"), ...rows.map(row => row.id)])];
      form.setValue("order_ids", ids, { shouldDirty: true, shouldValidate: true });
      form.clearErrors("root");
      toast.success(`${rows.length} ready orders in ${result.group_number}. Orders already selected are included once.`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add the order group.");
      return false;
    } finally { setGroupPending(false); }
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

      orderQuery.refetch();
    },
  });

  const driverExpensesMutation = useMutation({
    mutationFn: async () => {
      const points: {
        latitude: number;
        longitude: number;
      }[] = [];
      for (const order_id of order_ids) {
        const orderDetail = orderDetailQuery.data?.find(
          (order: DeliveryScheduleOrderDetail) => order.id === order_id,
        );

        if (orderDetail) {
          points.push({
            latitude: Number(orderDetail.shipping_latitude),
            longitude: Number(orderDetail.shipping_longitude),
          });
        }
      }

      const response = await fetch("/api/delivery-estimates", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          points: points,
          isRoundTrip: false,
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
    onSuccess: async (estimate: EstimateResponse) => {
      form.setValue(
        "delivery_allowance",
        Math.round(estimate.expenses.driverAllowance) || 0,
      );
      form.setValue(
        "fuel",
        Math.round(estimate.expenses.estimatedFuelCost) || 0,
      );
      form.setValue("toll", 0);
    },
  });

  return (
    <DeliveryScheduleContext.Provider
      value={{
        isStaff,
        removeSelection, startSchedule, addReadyGroup, groupPending,
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
        driverExpensesMutation,
      }}
    >
      {children}
    </DeliveryScheduleContext.Provider>
  );
}
