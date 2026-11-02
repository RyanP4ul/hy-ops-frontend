"use client";

import {
  Map,
  MapControls,
  MapMarker,
  type MapRef,
  MapRoute,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
} from "@/components/ui/map";
import { getErrorMessage } from "./api-client";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  MapPin,
  PanelLeft,
  PanelLeftClose,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Send,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { EmptyState } from "./components/empty-state";
import { FleetMapError, FleetMapLoading } from "./components/fleet-map-status";
import { ProgressBar } from "./components/progress-bar";
import { SegmentedTabs } from "./components/segmented-tabs";
import { StatCard } from "./components/stat-card";
import { StatusBadge } from "./components/status-badge";
import { StopRow } from "./components/stop-row";
import { TripCard } from "./components/trip-card";
import { WarehouseField } from "./components/warehouse-field";
import {
  createEmptyVehicle,
  EMPTY_WAREHOUSE_FORM,
  EMPTY_WAREHOUSES,
} from "./constants";
import { useFleetMutations } from "./hooks/use-fleet-mutations";
import { useFleetQuery } from "./hooks/use-fleet-query";
import { useFleetSimulation } from "./hooks/use-fleet-simulation";
import {
  formatCurrency,
  formatDay,
  formatSchedule,
  formatTime,
  getPaymentArrangementLabel,
  pluralize,
} from "./lib/format";
import {
  getNextDestination,
  getPosition,
  getRoute,
  getWarehouse,
} from "./lib/geometry";
import { withPaymentArrangement } from "./lib/payment";
import { dispatchNextTrip, mergeServerVehicles } from "./lib/simulation";
import {
  getProgressPercent,
  getTripValue,
  isRouteComplete,
} from "./lib/vehicle";
import type {
  Coordinates,
  DeliveryStop,
  DetailsTab,
  PaymentArrangement,
  SidebarView,
  Trip,
  Vehicle,
  WarehouseFormState,
  WarehouseLocation,
} from "./types";

export default function Page() {
  const fleet = useFleetQuery();
  const {
    assignVehicleWarehouse,
    dispatchDelivery,
    changePaymentArrangement,
    saveWarehouse,
    archiveWarehouse,
  } = useFleetMutations();

  // useEffect(() => {
  //   if (fleet.isError) console.error("Fleet query error:", fleet.error);
  //   console.log("Fleet data updated:", fleet.data);
  // }, [fleet.isFetched]);

  const warehouses = fleet.data?.warehouses ?? EMPTY_WAREHOUSES;
  // Server data is the source of truth; local state layers the live animation on top of it.
  // Seeded from the cache so a revisit (data already available on first render) isn't empty.
  const [vehicles, setVehicles] = useState<Vehicle[]>(
    () => fleet.data?.vehicles ?? [],
  );
  const [syncedFleet, setSyncedFleet] = useState(fleet.data);
  if (fleet.data !== syncedFleet) {
    setSyncedFleet(fleet.data);
    if (fleet.data) {
      const serverVehicles = fleet.data.vehicles;
      setVehicles((current) => mergeServerVehicles(current, serverVehicles));
    }
  }
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [warehouseManagerOpen, setWarehouseManagerOpen] = useState(false);
  const [warehouseFormOpen, setWarehouseFormOpen] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(
    null,
  );
  const [warehouseForm, setWarehouseForm] =
    useState<WarehouseFormState>(EMPTY_WAREHOUSE_FORM);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [orderPopoverOpenId, setOrderPopoverOpenId] = useState<string | null>(
    null,
  );
  const [focusedWarehouseId, setFocusedWarehouseId] = useState<string | null>(
    null,
  );
  const mapRef = useRef<MapRef>(null);

  const [sidebarView, setSidebarView] = useState<SidebarView>("vehicles");
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("current");
  // Id of the scheduled/completed trip currently expanded and drawn on the map.
  const [previewTripId, setPreviewTripId] = useState<string | null>(null);
  // When on, an idle vehicle automatically starts its next scheduled trip.
  const [autoDispatch, setAutoDispatch] = useState(false);

  useFleetSimulation({ vehicles, setVehicles, isRunning, autoDispatch });

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedId) ??
    vehicles[0] ??
    createEmptyVehicle(warehouses[0]?.id ?? "");

  // Every hook is above this point, so early returns are safe.
  if (fleet.isPending) return <FleetMapLoading />;
  if (fleet.isError) {
    return (
      <FleetMapError
        message={getErrorMessage(fleet.error)}
        onRetry={() => void fleet.refetch()}
      />
    );
  }

  const activeCount = vehicles.filter(
    (vehicle) =>
      vehicle.status === "delivering" || vehicle.status === "returning",
  ).length;

  const allStops = vehicles.flatMap((vehicle) =>
    vehicle.stops.map((stop) => ({
      ...stop,
      vehicleId: vehicle.id,
      color: isRouteComplete(vehicle) ? vehicle.color : "#94a3b8",
    })),
  );

  const completedCount = allStops.filter(
    (stop) => stop.status === "completed",
  ).length;

  const selectedWarehouse = getWarehouse(selectedVehicle, warehouses);
  const selectedPosition = getPosition(selectedVehicle, warehouses);
  const nextDestination = getNextDestination(selectedVehicle, warehouses);
  function selectVehicle(vehicle: Vehicle) {
    setSelectedId(vehicle.id);
    setOrderPopoverOpenId(null);
    setPreviewTripId(null);

    // Center and zoom the map on the vehicle's current simulated position.
    // This is shared by sidebar selection and vehicle-marker clicks.
    mapRef.current?.easeTo({
      center: getPosition(vehicle, warehouses),
      zoom: 14,
      duration: 800,
    });
  }

  function focusWarehouse(warehouse: WarehouseLocation) {
    setFocusedWarehouseId(warehouse.id);
    mapRef.current?.easeTo({
      center: warehouse.coordinates,
      zoom: 14,
      duration: 800,
    });
  }

  function startEditingWarehouse(warehouse: WarehouseLocation) {
    setEditingWarehouseId(warehouse.id);
    setWarehouseForm({
      name: warehouse.name,
      streetAddress: warehouse.streetAddress,
      city: warehouse.city,
      state: warehouse.state,
      zipCode: warehouse.zipCode,
      longitude: String(warehouse.coordinates[0]),
      latitude: String(warehouse.coordinates[1]),
    });
    setWarehouseError(null);
    setWarehouseFormOpen(true);
  }

  function resetWarehouseForm() {
    setEditingWarehouseId(null);
    setWarehouseForm(EMPTY_WAREHOUSE_FORM);
    setWarehouseError(null);
    setWarehouseFormOpen(false);
  }

  async function handleWarehouseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const longitude = Number(warehouseForm.longitude);
    const latitude = Number(warehouseForm.latitude);
    const name = warehouseForm.name.trim();
    const streetAddress = warehouseForm.streetAddress.trim();
    const city = warehouseForm.city.trim();
    const state = warehouseForm.state.trim();
    const zipCode = warehouseForm.zipCode.trim();

    if (!name || !streetAddress || !city || !state || !zipCode) {
      setWarehouseError("Enter the warehouse name and its full address.");
      return;
    }

    if (
      !warehouseForm.longitude.trim() ||
      !warehouseForm.latitude.trim() ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      setWarehouseError(
        "Enter valid longitude (-180 to 180) and latitude (-90 to 90) values.",
      );
      return;
    }

    try {
      await saveWarehouse.mutateAsync({
        id: editingWarehouseId,
        values: {
          name,
          streetAddress,
          city,
          state,
          zipCode,
          longitude,
          latitude,
        },
      });
      resetWarehouseForm();
    } catch (error) {
      setWarehouseError(getErrorMessage(error));
    }
  }

  function deleteWarehouse(warehouse: WarehouseLocation) {
    const isAssigned = vehicles.some(
      (vehicle) => vehicle.warehouseId === warehouse.id,
    );
    if (isAssigned || warehouses.length <= 1) return;
    if (!window.confirm(`Delete ${warehouse.name}?`)) return;

    archiveWarehouse.mutate(warehouse.id, {
      onSuccess: () => {
        if (focusedWarehouseId === warehouse.id) setFocusedWarehouseId(null);
        if (editingWarehouseId === warehouse.id) resetWarehouseForm();
      },
      onError: (error) => window.alert(getErrorMessage(error)),
    });
  }

  function assignWarehouse(vehicleId: string, warehouseId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (!vehicle || vehicle.status !== "available") return;

    setVehicles((current) =>
      current.map((item) =>
        item.id === vehicleId ? { ...item, warehouseId } : item,
      ),
    );
    assignVehicleWarehouse.mutate({ vehicleId, warehouseId });
  }

  function updateOrderPaymentArrangement(
    orderId: string,
    arrangement: PaymentArrangement,
  ) {
    const updateStops = (stops: DeliveryStop[]) =>
      stops.map((stop) =>
        stop.order.id === orderId
          ? withPaymentArrangement(stop, arrangement)
          : stop,
      );

    // An order can live in the current trip or in a scheduled trip.
    setVehicles((current) =>
      current.map((vehicle) => ({
        ...vehicle,
        stops: updateStops(vehicle.stops),
        scheduledTrips: vehicle.scheduledTrips.map((trip) => ({
          ...trip,
          stops: updateStops(trip.stops),
        })),
      })),
    );
    changePaymentArrangement.mutate({
      orderNumber: orderId,
      paymentArrangement: arrangement,
    });
  }

  // Zoom the map so the whole trip (warehouse + stops) is visible.
  function fitToTrip(vehicle: Vehicle, trip: Trip) {
    const map = mapRef.current;
    if (!map) return;

    const points = [
      getWarehouse(vehicle, warehouses).coordinates,
      ...trip.stops.map((stop) => stop.coordinates),
    ];
    const lngs = points.map((point) => point[0]);
    const lats = points.map((point) => point[1]);
    const roomForPanel = map.getContainer().clientWidth > 900;

    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      {
        padding: {
          top: 90,
          bottom: 120,
          left: roomForPanel ? 440 : 40, // keep clear of the details panel
          right: 70,
        },
        maxZoom: 14,
        duration: 800,
      },
    );
  }

  function togglePreview(vehicle: Vehicle, trip: Trip) {
    setOrderPopoverOpenId(null);
    if (previewTripId === trip.id) {
      setPreviewTripId(null);
      return;
    }
    setPreviewTripId(trip.id);
    fitToTrip(vehicle, trip);
  }

  // Used by the sidebar schedule: select the vehicle, open its Scheduled tab, preview the trip.
  function openTripFromSchedule(vehicle: Vehicle, trip: Trip) {
    setSelectedId(vehicle.id);
    setDetailsTab("scheduled");
    setDetailsOpen(true);
    setOrderPopoverOpenId(null);
    setPreviewTripId(trip.id);
    fitToTrip(vehicle, trip);
  }

  function changeDetailsTab(tab: DetailsTab) {
    setDetailsTab(tab);
    setPreviewTripId(null);
    setOrderPopoverOpenId(null);
  }

  function dispatchTrip(vehicleId: string, tripId?: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    const targetTripId = tripId ?? vehicle?.scheduledTrips[0]?.id;

    if (
      vehicle &&
      targetTripId &&
      vehicle.status === "available" &&
      !vehicle.blockedReason
    ) {
      setVehicles((current) =>
        current.map((item) =>
          item.id === vehicleId ? dispatchNextTrip(item, targetTripId) : item,
        ),
      );
      dispatchDelivery.mutate(targetTripId);
    }

    setPreviewTripId(null);
    setOrderPopoverOpenId(null);
    setDetailsTab("current");
  }

  const scheduledCount = vehicles.reduce(
    (total, vehicle) => total + vehicle.scheduledTrips.length,
    0,
  );

  // Every upcoming trip across the fleet, earliest first, grouped by day.
  const upcomingTrips = vehicles
    .flatMap((vehicle) =>
      vehicle.scheduledTrips.map((trip) => ({ trip, vehicle })),
    )
    .sort(
      (a, b) => Date.parse(a.trip.scheduledAt) - Date.parse(b.trip.scheduledAt),
    );

  const scheduleByDay = upcomingTrips.reduce<
    { day: string; items: typeof upcomingTrips }[]
  >((groups, item) => {
    const day = formatDay(item.trip.scheduledAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
    return groups;
  }, []);

  const previewedTrip =
    selectedVehicle.scheduledTrips.find((trip) => trip.id === previewTripId) ??
    null;
  const nextScheduledTrip = selectedVehicle.scheduledTrips[0];

  const renderStops = (stops: DeliveryStop[]) =>
    stops.map((stop, index) => (
      <StopRow
        key={stop.id}
        stop={stop}
        index={index}
        orderOpen={orderPopoverOpenId === stop.order.id}
        onOrderOpenChange={(open) =>
          setOrderPopoverOpenId(open ? stop.order.id : null)
        }
        onPaymentChange={updateOrderPaymentArrangement}
      />
    ));

  return (
    <div className="flex h-[820px] min-h-[650px] w-full flex-col overflow-hidden rounded-2xl border bg-background text-foreground lg:flex-row">
      {/* SIDEBAR */}
      <aside
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } z-20 min-h-0 w-full shrink-0 flex-col border-b bg-background lg:w-[350px] lg:border-b-0 lg:border-r`}
      >
        <div className="border-b p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Fleet control
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Live vehicles, trips and warehouses
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsRunning((running) => !running)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition hover:bg-muted"
            >
              {isRunning ? (
                <Pause className="size-3.5" />
              ) : (
                <Play className="size-3.5" />
              )}
              {isRunning ? "Pause" : "Resume"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatCard label="Active" value={activeCount} hint="On the road" />
            <StatCard
              label="Stops done"
              value={`${completedCount}/${allStops.length}`}
              hint="Current trips"
            />
            <StatCard
              label="Scheduled"
              value={scheduledCount}
              hint="Upcoming trips"
            />
          </div>
        </div>

        <div className="border-b px-3 py-2.5">
          <SegmentedTabs<SidebarView>
            label="Sidebar view"
            value={sidebarView}
            onChange={setSidebarView}
            tabs={[
              { value: "vehicles", label: "Vehicles", count: vehicles.length },
              { value: "schedule", label: "Schedule", count: scheduledCount },
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {sidebarView === "vehicles" &&
            vehicles.map((vehicle) => {
              const selected = vehicle.id === selectedId;
              const destination = getNextDestination(vehicle, warehouses);
              const percent = getProgressPercent(vehicle);

              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => selectVehicle(vehicle)}
                  aria-pressed={selected}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-transparent hover:border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${vehicle.color}18`,
                        color: vehicle.color,
                      }}
                    >
                      <Truck className="size-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {vehicle.id}
                        </span>
                        <StatusBadge
                          status={vehicle.blockedReason ?? vehicle.status}
                        />
                      </div>

                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {vehicle.driver} · {vehicle.plate}
                      </p>

                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {vehicle.status === "returning" ||
                        vehicle.status === "available" ? (
                          <Warehouse className="size-3.5 shrink-0" />
                        ) : (
                          <MapPin className="size-3.5 shrink-0" />
                        )}
                        <span className="truncate">
                          {destination?.name ?? "No destination"}
                        </span>
                      </p>

                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="truncate text-muted-foreground">
                          {vehicle.trip?.label ?? "No trip yet"} ·{" "}
                          {vehicle.completedStops}/{vehicle.stops.length} stops
                        </span>
                        <span
                          className="font-medium tabular-nums"
                          style={{ color: vehicle.color }}
                        >
                          {percent}%
                        </span>
                      </div>

                      <div className="mt-1">
                        <ProgressBar percent={percent} color={vehicle.color} />
                      </div>

                      {vehicle.scheduledTrips.length > 0 && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-1 text-[10px] font-medium text-muted-foreground">
                          <CalendarClock className="size-3" />
                          {pluralize(
                            vehicle.scheduledTrips.length,
                            "trip",
                          )}{" "}
                          scheduled
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

          {sidebarView === "schedule" &&
            (scheduleByDay.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="size-5" />}
                title="No upcoming trips"
                description="Trips scheduled for your vehicles will show up here."
              />
            ) : (
              scheduleByDay.map((group) => (
                <div key={group.day} className="space-y-2">
                  <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.day}
                  </p>

                  {group.items.map(({ trip, vehicle }) => {
                    const active = previewTripId === trip.id;

                    return (
                      <button
                        key={trip.id}
                        type="button"
                        onClick={() => openTripFromSchedule(vehicle, trip)}
                        aria-pressed={active}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "hover:border-border hover:bg-muted/50"
                        }`}
                      >
                        <div
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: `${vehicle.color}18`,
                            color: vehicle.color,
                          }}
                        >
                          <Truck className="size-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">
                              {trip.label}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {formatTime(trip.scheduledAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {vehicle.id} · {vehicle.driver}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {pluralize(trip.stops.length, "stop")} ·{" "}
                            {formatCurrency(getTripValue(trip.stops))}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            ))}
        </div>

        <section className="shrink-0 border-t">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setWarehouseManagerOpen((open) => !open)}
              className="flex items-center gap-2 text-sm font-semibold"
              aria-expanded={warehouseManagerOpen}
            >
              <Warehouse className="size-4 text-muted-foreground" />
              Warehouses
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {warehouses.length}
              </span>
              <ChevronDown
                className={`size-3.5 text-muted-foreground transition-transform ${warehouseManagerOpen ? "rotate-180" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                if (warehouseFormOpen) {
                  resetWarehouseForm();
                } else {
                  setEditingWarehouseId(null);
                  setWarehouseForm(EMPTY_WAREHOUSE_FORM);
                  setWarehouseError(null);
                  setWarehouseFormOpen(true);
                  setWarehouseManagerOpen(true);
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            >
              {warehouseFormOpen ? (
                <X className="size-3.5" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {warehouseFormOpen ? "Cancel" : "Add"}
            </button>
          </div>

          {warehouseManagerOpen && (
            <div className="max-h-[290px] space-y-2 overflow-y-auto px-3 pb-3">
              {warehouses.map((warehouse) => {
                const assignedVehicles = vehicles.filter(
                  (vehicle) => vehicle.warehouseId === warehouse.id,
                );
                const isAssigned = assignedVehicles.length > 0;

                return (
                  <div key={warehouse.id} className="rounded-xl border p-3">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => focusWarehouse(warehouse)}
                        aria-label={`Locate ${warehouse.name} on map`}
                        className={`flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left transition hover:bg-muted/50 ${focusedWarehouseId === warehouse.id ? "text-primary" : ""}`}
                      >
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${focusedWarehouseId === warehouse.id ? "bg-primary/10" : "bg-muted"}`}
                        >
                          <Warehouse
                            className={`size-4 ${focusedWarehouseId === warehouse.id ? "text-primary" : "text-muted-foreground"}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">
                            {warehouse.name}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {warehouse.address}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {assignedVehicles.length} vehicle
                            {assignedVehicles.length === 1 ? "" : "s"} assigned
                            · {warehouse.id}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditingWarehouse(warehouse)}
                        aria-label={`Edit ${warehouse.name}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWarehouse(warehouse)}
                        disabled={isAssigned || warehouses.length <= 1}
                        title={
                          isAssigned
                            ? "Reassign vehicles before deleting this warehouse"
                            : warehouses.length <= 1
                              ? "Keep at least one warehouse"
                              : "Delete warehouse"
                        }
                        aria-label={`Delete ${warehouse.name}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    {isAssigned && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Reassign its vehicles before deleting this warehouse.
                      </p>
                    )}
                  </div>
                );
              })}

              {warehouseFormOpen && (
                <form
                  onSubmit={handleWarehouseSubmit}
                  className="space-y-3 rounded-xl border border-primary/30 bg-muted/20 p-3"
                >
                  <p className="text-xs font-semibold">
                    {editingWarehouseId ? "Edit warehouse" : "Add warehouse"}
                  </p>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Name
                    </span>
                    <input
                      required
                      value={warehouseForm.name}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setWarehouseForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g. North Warehouse"
                      className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <WarehouseField
                    label="Street address"
                    value={warehouseForm.streetAddress}
                    placeholder="Unit / street / barangay"
                    onChange={(streetAddress) =>
                      setWarehouseForm((current) => ({
                        ...current,
                        streetAddress,
                      }))
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <WarehouseField
                      label="City"
                      value={warehouseForm.city}
                      placeholder="Quezon City"
                      onChange={(city) =>
                        setWarehouseForm((current) => ({ ...current, city }))
                      }
                    />
                    <WarehouseField
                      label="State / province"
                      value={warehouseForm.state}
                      placeholder="Metro Manila"
                      onChange={(state) =>
                        setWarehouseForm((current) => ({ ...current, state }))
                      }
                    />
                  </div>
                  <WarehouseField
                    label="ZIP code"
                    value={warehouseForm.zipCode}
                    placeholder="1100"
                    inputMode="numeric"
                    onChange={(zipCode) =>
                      setWarehouseForm((current) => ({ ...current, zipCode }))
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Longitude
                      </span>
                      <input
                        required
                        inputMode="decimal"
                        value={warehouseForm.longitude}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setWarehouseForm((current) => ({
                            ...current,
                            longitude: event.target.value,
                          }))
                        }
                        placeholder="121.0437"
                        className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Latitude
                      </span>
                      <input
                        required
                        inputMode="decimal"
                        value={warehouseForm.latitude}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setWarehouseForm((current) => ({
                            ...current,
                            latitude: event.target.value,
                          }))
                        }
                        placeholder="14.676"
                        className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                  </div>
                  {warehouseError && (
                    <p role="alert" className="text-[11px] text-destructive">
                      {warehouseError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetWarehouseForm}
                      className="h-9 flex-1 rounded-lg border px-3 text-xs font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saveWarehouse.isPending}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Save className="size-3.5" />
                      {editingWarehouseId ? "Save" : "Create"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>

        <div className="space-y-3 border-t p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Auto-dispatch next trip</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Start the next scheduled trip as soon as a vehicle is back at
                its warehouse.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoDispatch}
              aria-label="Auto-dispatch next trip"
              onClick={() => setAutoDispatch((on) => !on)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                autoDispatch ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-background shadow transition-transform ${
                  autoDispatch ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`size-2 rounded-full ${
                isRunning ? "animate-pulse bg-green-500" : "bg-amber-500"
              }`}
            />
            {isRunning ? "Simulation running" : "Simulation paused"}
            <span className="ml-auto">1 sec / tick</span>
          </p>
        </div>
      </aside>

      {/* MAP */}
      <main className="relative min-h-[500px] flex-1">
        <Map
          ref={mapRef}
          center={[121.035, 14.603]}
          zoom={11}
          className="h-full min-h-[500px] w-full"
        >
          <MapControls position="top-right" />

          {/* ROUTES: each delivery segment reflects its destination stop status. */}
          {vehicles
            .flatMap((vehicle) => {
              const route = getRoute(vehicle, warehouses);
              const selected = vehicle.id === selectedId;
              const stopSegments = vehicle.stops.map((stop, index) => ({
                key: `route-${vehicle.id}-${stop.id}`,
                coordinates: [
                  route[index]!,
                  route[index + 1]!,
                ] as Coordinates[],
                color: stop.status === "completed" ? vehicle.color : "#94a3b8",
              }));

              // The final segment is the return leg. Keep it gray until the vehicle
              // has completed the route and returned to its assigned warehouse.
              const returnStart = route[route.length - 2];
              const returnEnd = route[route.length - 1];
              const returnSegment =
                returnStart && returnEnd
                  ? [
                      {
                        key: `route-${vehicle.id}-return`,
                        coordinates: [returnStart, returnEnd] as Coordinates[],
                        color: isRouteComplete(vehicle)
                          ? vehicle.color
                          : "#94a3b8",
                      },
                    ]
                  : [];

              return [...stopSegments, ...returnSegment].map((segment) => ({
                ...segment,
                selected,
              }));
            })
            .map((segment) => (
              <MapRoute
                key={segment.key}
                coordinates={segment.coordinates}
                color={segment.color}
                width={segment.selected ? 5 : 3}
                opacity={segment.selected ? 0.9 : 0.5}
              />
            ))}

          {/* WAREHOUSES */}
          {warehouses.map((warehouse) => (
            <MapMarker
              key={warehouse.id}
              longitude={warehouse.coordinates[0]}
              latitude={warehouse.coordinates[1]}
              onClick={() => focusWarehouse(warehouse)}
            >
              <MarkerContent>
                <div
                  className={`flex size-10 items-center justify-center rounded-xl border-2 border-white text-white shadow-lg transition-transform ${focusedWarehouseId === warehouse.id ? "scale-110 ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{
                    backgroundColor:
                      focusedWarehouseId === warehouse.id
                        ? "hsl(var(--primary))"
                        : "#0f172a",
                  }}
                  aria-label={warehouse.name}
                >
                  <Warehouse className="size-5" />
                </div>
              </MarkerContent>

              <MarkerTooltip>
                <div>
                  <p className="font-semibold">{warehouse.name}</p>
                  <p className="text-xs">{warehouse.address}</p>
                </div>
              </MarkerTooltip>

              <MarkerPopup>
                <div className="min-w-40 space-y-1 p-1">
                  <div className="flex items-center gap-2">
                    <Warehouse className="size-4" />
                    <p className="font-semibold">{warehouse.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {warehouse.address}
                  </p>
                  <p className="text-xs">{warehouse.id}</p>
                </div>
              </MarkerPopup>
            </MapMarker>
          ))}

          {/* DELIVERY STOPS */}
          {vehicles.flatMap((vehicle) =>
            vehicle.stops.map((stop, index) => (
              <MapMarker
                key={`${vehicle.id}-${stop.id}`}
                longitude={stop.coordinates[0]}
                latitude={stop.coordinates[1]}
                onClick={() => {
                  selectVehicle(vehicle);
                  setDetailsOpen(true);
                }}
              >
                <MarkerContent>
                  <div
                    className={`flex size-7 items-center justify-center rounded-full border-2 border-white shadow-md ${
                      stop.status === "completed"
                        ? "bg-green-600 text-white"
                        : "bg-amber-400 text-slate-950"
                    }`}
                  >
                    {stop.status === "completed" ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <span className="text-[10px] font-bold">{index + 1}</span>
                    )}
                  </div>
                </MarkerContent>

                <MarkerTooltip>
                  <div className="space-y-1">
                    <p className="font-semibold">{stop.name}</p>
                    <p className="text-xs">{vehicle.id}</p>
                    <p className="text-xs">
                      {stop.status === "completed" ? "Completed" : "Pending"}
                    </p>
                  </div>
                </MarkerTooltip>

                <MarkerPopup>
                  <div className="min-w-40 space-y-2 p-1">
                    <p className="font-semibold">{stop.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {stop.address}
                    </p>
                    <p className="text-xs">Vehicle: {vehicle.id}</p>
                    <div className="rounded-lg bg-muted/60 p-2">
                      <p className="text-xs font-semibold">
                        Order {stop.order.id}
                      </p>
                      <p className="text-xs">{stop.order.customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getPaymentArrangementLabel(
                          stop.order.paymentArrangement,
                        )}{" "}
                        · {formatCurrency(stop.order.totalAmount)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                        stop.status === "completed"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-amber-500/10 text-amber-700"
                      }`}
                    >
                      {stop.status === "completed" ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <Clock3 className="size-3" />
                      )}
                      {stop.status === "completed" ? "Completed" : "Pending"}
                    </span>
                  </div>
                </MarkerPopup>
              </MapMarker>
            )),
          )}

          {/* TRIP PREVIEW: dashed route + numbered stops of the expanded trip */}
          {previewedTrip && (
            <>
              <MapRoute
                coordinates={[
                  selectedWarehouse.coordinates,
                  ...previewedTrip.stops.map((stop) => stop.coordinates),
                  selectedWarehouse.coordinates,
                ]}
                color={selectedVehicle.color}
                width={4}
                opacity={0.9}
                dashArray={[2, 2]}
              />
              {previewedTrip.stops.map((stop, index) => (
                <MapMarker
                  key={`preview-${previewedTrip.id}-${stop.id}`}
                  longitude={stop.coordinates[0]}
                  latitude={stop.coordinates[1]}
                >
                  <MarkerContent>
                    <div
                      className="flex size-7 items-center justify-center rounded-full border-2 border-dashed bg-background text-[10px] font-bold shadow-md"
                      style={{
                        borderColor: selectedVehicle.color,
                        color: selectedVehicle.color,
                      }}
                    >
                      {index + 1}
                    </div>
                  </MarkerContent>

                  <MarkerTooltip>
                    <div className="space-y-1">
                      <p className="font-semibold">{stop.name}</p>
                      <p className="text-xs">
                        {previewedTrip.label} · {selectedVehicle.id}
                      </p>
                      <p className="text-xs">
                        {formatSchedule(previewedTrip.scheduledAt)}
                      </p>
                    </div>
                  </MarkerTooltip>
                </MapMarker>
              ))}
            </>
          )}

          {/* VEHICLES */}
          {vehicles.map((vehicle) => {
            const [longitude, latitude] = getPosition(vehicle, warehouses);
            const selected = vehicle.id === selectedId;

            return (
              <MapMarker
                key={`vehicle-${vehicle.id}`}
                longitude={longitude}
                latitude={latitude}
                onClick={() => {
                  selectVehicle(vehicle);
                  setDetailsOpen(true);
                }}
              >
                <MarkerContent>
                  <div
                    className={`relative flex size-10 items-center justify-center rounded-xl border-2 border-white text-white shadow-lg ${
                      selected ? "scale-110" : ""
                    }`}
                    style={{ backgroundColor: vehicle.color }}
                  >
                    {vehicle.status === "returning" ? (
                      <Warehouse className="size-5" />
                    ) : (
                      <Truck className="size-5" />
                    )}
                    {vehicle.status !== "available" && (
                      <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-green-400" />
                    )}
                  </div>
                </MarkerContent>

                <MarkerTooltip>
                  <div className="space-y-1">
                    <p className="font-semibold">{vehicle.id}</p>
                    <p className="text-xs">{vehicle.driver}</p>
                    <p className="text-xs">
                      {vehicle.status === "returning"
                        ? "Returning to warehouse"
                        : vehicle.status === "available"
                          ? "Available at warehouse"
                          : "Delivering orders"}
                    </p>
                  </div>
                </MarkerTooltip>

                <MarkerPopup>
                  <div className="min-w-44 space-y-2 p-1">
                    <div className="flex items-center gap-2">
                      <Truck
                        className="size-5"
                        style={{ color: vehicle.color }}
                      />
                      <p className="font-semibold">{vehicle.id}</p>
                    </div>
                    <p className="text-xs">{vehicle.driver}</p>
                    <p className="text-xs text-muted-foreground">
                      {getWarehouse(vehicle, warehouses)?.name ??
                        "No warehouse assigned"}
                    </p>
                    <p className="text-xs">
                      {vehicle.completedStops}/{vehicle.stops.length} stops
                      completed
                    </p>
                    <p className="text-xs font-medium">
                      {vehicle.status === "returning"
                        ? "Returning to warehouse"
                        : vehicle.status === "available"
                          ? "Available"
                          : `Next: ${getNextDestination(vehicle, warehouses)?.name ?? "No destination"}`}
                    </p>
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}
        </Map>

        {/* MAP HEADER */}
        <div className="absolute left-4 right-16 top-4 z-20 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-start gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={
                sidebarOpen ? "Hide vehicle sidebar" : "Show vehicle sidebar"
              }
              aria-expanded={sidebarOpen}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background/95 shadow-sm backdrop-blur transition hover:bg-muted"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeft className="size-4" />
              )}
            </button>

            {previewedTrip && (
              <div className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border bg-background/95 py-1.5 pl-3 pr-1.5 shadow-sm backdrop-blur">
                <CalendarClock
                  className="size-4 shrink-0"
                  style={{ color: selectedVehicle.color }}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">
                    Previewing {previewedTrip.label}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {selectedVehicle.id} ·{" "}
                    {formatSchedule(previewedTrip.scheduledAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewTripId(null)}
                  aria-label="Clear trip preview"
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
            <p className="flex items-center gap-2 text-xs font-medium">
              <span
                className={`size-2 rounded-full ${
                  isRunning ? "animate-pulse bg-green-500" : "bg-amber-500"
                }`}
              />
              {activeCount} active
            </p>
            <div className="hidden items-center gap-3 border-l pl-3 text-[11px] text-muted-foreground sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber-400" />
                Pending
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-green-600" />
                Done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border border-dashed border-foreground" />
                Scheduled
              </span>
            </div>
          </div>
        </div>

        {/* SELECTED VEHICLE PANEL */}
        <div className="absolute bottom-4 left-4 z-20 w-[calc(100%-2rem)] max-w-sm">
          {/* Trigger */}
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            className="flex w-full items-center gap-3 rounded-2xl border bg-background/95 p-3 text-left shadow-lg backdrop-blur transition hover:bg-muted/95"
          >
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: `${selectedVehicle.color}18`,
                color: selectedVehicle.color,
              }}
            >
              {selectedVehicle.status === "returning" ? (
                <Warehouse className="size-5" />
              ) : (
                <Truck className="size-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {selectedVehicle.id}
                </span>
                <StatusBadge
                  status={
                    selectedVehicle.blockedReason ?? selectedVehicle.status
                  }
                />
              </div>

              <p className="mt-1 truncate text-xs text-muted-foreground">
                {selectedVehicle.trip?.label ?? "No trip yet"} ·{" "}
                {selectedVehicle.completedStops}/{selectedVehicle.stops.length}{" "}
                stops · {selectedVehicle.driver}
              </p>

              {selectedVehicle.scheduledTrips.length > 0 && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="size-3" />
                  {pluralize(
                    selectedVehicle.scheduledTrips.length,
                    "more trip",
                  )}{" "}
                  scheduled
                </p>
              )}
            </div>

            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                detailsOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Panel */}
          {detailsOpen && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 flex max-h-[min(65vh,560px)] flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
              {/* Header + tabs */}
              <div className="shrink-0 space-y-3 border-b p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">Vehicle details</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {selectedVehicle.driver} · {selectedVehicle.plate}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDetailsOpen(false)}
                    aria-label="Close vehicle details"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <SegmentedTabs<DetailsTab>
                  label="Trips"
                  value={detailsTab}
                  onChange={changeDetailsTab}
                  tabs={[
                    { value: "current", label: "Current" },
                    {
                      value: "scheduled",
                      label: "Scheduled",
                      count: selectedVehicle.scheduledTrips.length,
                    },
                  ]}
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* CURRENT TRIP */}
                {detailsTab === "current" && (
                  <div className="space-y-3 p-4">
                    {selectedVehicle.status === "available" &&
                      !selectedVehicle.blockedReason &&
                      nextScheduledTrip && (
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                          <p className="text-xs font-semibold">
                            Ready for the next trip
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {nextScheduledTrip.label} ·{" "}
                            {formatSchedule(nextScheduledTrip.scheduledAt)} ·{" "}
                            {pluralize(nextScheduledTrip.stops.length, "stop")}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => dispatchTrip(selectedVehicle.id)}
                              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                            >
                              <Send className="size-3.5" />
                              Dispatch now
                            </button>
                            <button
                              type="button"
                              onClick={() => changeDetailsTab("scheduled")}
                              className="h-9 flex-1 rounded-lg border px-3 text-xs font-medium hover:bg-muted"
                            >
                              View schedule
                            </button>
                          </div>
                        </div>
                      )}

                    {/* Trip summary */}
                    <div className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">
                            {selectedVehicle.status === "available"
                              ? "Last trip"
                              : "Current trip"}
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold">
                            {selectedVehicle.trip?.label ?? "No trip yet"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {selectedVehicle.trip
                              ? formatSchedule(selectedVehicle.trip.scheduledAt)
                              : "—"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-semibold tabular-nums">
                            {getProgressPercent(selectedVehicle)}%
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {selectedVehicle.completedStops}/
                            {selectedVehicle.stops.length} stops
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <ProgressBar
                          percent={getProgressPercent(selectedVehicle)}
                          color={selectedVehicle.color}
                        />
                      </div>

                      {selectedVehicle.scheduledTrips.length > 0 && (
                        <button
                          type="button"
                          onClick={() => changeDetailsTab("scheduled")}
                          className="mt-3 flex w-full items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs font-medium transition hover:bg-muted"
                        >
                          <span className="flex items-center gap-2">
                            <CalendarClock className="size-3.5" />
                            {pluralize(
                              selectedVehicle.scheduledTrips.length,
                              "upcoming trip",
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            View schedule
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/60 p-3">
                        <p className="text-xs text-muted-foreground">Speed</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {selectedVehicle.speed}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            km/h
                          </span>
                        </p>
                      </div>

                      <div className="rounded-xl bg-muted/60 p-3">
                        <p className="text-xs text-muted-foreground">
                          Stops remaining
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {selectedVehicle.stops.length -
                            selectedVehicle.completedStops}
                        </p>
                      </div>
                    </div>

                    {/* Assigned warehouse */}
                    <div className="rounded-xl border p-3">
                      <label
                        htmlFor="vehicle-warehouse"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Assigned warehouse
                      </label>
                      <select
                        id="vehicle-warehouse"
                        value={selectedVehicle.warehouseId}
                        disabled={selectedVehicle.status !== "available"}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          assignWarehouse(
                            selectedVehicle.id,
                            event.target.value,
                          )
                        }
                        className="mt-2 h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {selectedVehicle.status === "available"
                          ? "Choose the warehouse for this vehicle's next trip."
                          : "Warehouse assignment is locked while the vehicle is delivering or returning."}
                      </p>
                    </div>

                    {/* Destination */}
                    <div className="rounded-xl border p-3">
                      <p className="text-xs text-muted-foreground">
                        {selectedVehicle.status === "returning"
                          ? "Returning to warehouse"
                          : selectedVehicle.status === "available"
                            ? "Current location"
                            : "Next destination"}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        {selectedVehicle.status === "returning" ||
                        selectedVehicle.status === "available" ? (
                          <Warehouse className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <MapPin className="size-4 shrink-0 text-muted-foreground" />
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {nextDestination?.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {nextDestination?.address}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stops */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">Delivery stops</p>
                        <span className="text-xs text-muted-foreground">
                          {selectedVehicle.stops.length -
                            selectedVehicle.completedStops}{" "}
                          remaining
                        </span>
                      </div>

                      <div className="space-y-2">
                        {renderStops(selectedVehicle.stops)}

                        {/* Return-to-warehouse status */}
                        <div className="flex items-center gap-3 rounded-xl border border-dashed p-3">
                          <Warehouse className="size-5 shrink-0 text-muted-foreground" />

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              Return to {selectedWarehouse.name}
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {selectedWarehouse.address}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${
                              selectedVehicle.status === "available"
                                ? "bg-green-500/10 text-green-600"
                                : selectedVehicle.status === "returning"
                                  ? "bg-amber-500/10 text-amber-600"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {selectedVehicle.status === "available"
                              ? "Arrived"
                              : selectedVehicle.status === "returning"
                                ? "Returning"
                                : "Waiting"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SCHEDULED TRIPS */}
                {detailsTab === "scheduled" && (
                  <div className="space-y-3 p-4">
                    {selectedVehicle.scheduledTrips.length === 0 ? (
                      <EmptyState
                        icon={<CalendarClock className="size-5" />}
                        title="Nothing scheduled"
                        description={`${selectedVehicle.id} has no upcoming trips.`}
                      />
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {selectedVehicle.status === "available"
                            ? "This vehicle is at its warehouse. Dispatch a trip when you're ready."
                            : "Open a trip to preview its route on the map. Trips can be dispatched once the vehicle is back at its warehouse."}
                        </p>

                        {selectedVehicle.scheduledTrips.map((trip, index) => (
                          <TripCard
                            key={trip.id}
                            trip={trip}
                            color={selectedVehicle.color}
                            expanded={previewTripId === trip.id}
                            onToggle={() =>
                              togglePreview(selectedVehicle, trip)
                            }
                            tag={
                              index === 0 ? (
                                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                  Next
                                </span>
                              ) : undefined
                            }
                            footer={
                              <button
                                type="button"
                                disabled={
                                  selectedVehicle.status !== "available" ||
                                  Boolean(selectedVehicle.blockedReason)
                                }
                                onClick={() =>
                                  dispatchTrip(selectedVehicle.id, trip.id)
                                }
                                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Send className="size-3.5" />
                                {selectedVehicle.status === "available"
                                  ? "Dispatch this trip now"
                                  : "Available after the current trip"}
                              </button>
                            }
                          >
                            {renderStops(trip.stops)}
                          </TripCard>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Coordinates and simulation state */}
              <div className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Activity className="size-3.5" />
                  {isRunning ? "Live simulation" : "Simulation paused"}
                </span>

                <span className="tabular-nums">
                  {selectedPosition[1].toFixed(5)},{" "}
                  {selectedPosition[0].toFixed(5)}
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
