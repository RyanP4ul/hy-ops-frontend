"use client";

import { AlertCircle, CheckCircle2, FlaskConical, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "@/components/ui/map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { REQUESTS } from "@/constant/request";
import { getErrorMessage } from "./api-client";
import { FleetMapError, FleetMapLoading } from "./components/fleet-map-status";
import { useReturnPickups } from "./components/return-pickups";
import { FleetMapCanvas } from "./components/map-canvas";
import { SimulationControls } from "./components/simulation-controls";
import { Sidebar, type SidebarTab } from "./components/sidebar";
import { Topbar, type FleetView } from "./components/topbar";
import { VehiclePanel, type PanelTab } from "./components/vehicle-panel";
import { EMPTY_WAREHOUSES, FLEET_POLL_MS } from "./constants";
import { useFleetMutations } from "./hooks/use-fleet-mutations";
import { fleetKeys, useFleetQuery } from "./hooks/use-fleet-query";
import { useFleetSimulation } from "./hooks/use-fleet-simulation";
import { useLivePositions } from "./hooks/use-live-positions";
import { useNow } from "./hooks/use-now";
import { liveRoutePoints } from "./lib/live-route";
import { useRoadRoutes } from "./hooks/use-road-routes";
import { getBounds, getWarehouse } from "./lib/geometry";
import { resolveVehiclePosition } from "./lib/live";
import { withPaymentArrangement } from "./lib/payment";
import { dispatchNextTrip, syncVehicles } from "./lib/simulation";
import { isAvailableVehicle } from "./lib/vehicle";
import type {
  DeliveryStop,
  PaymentArrangement,
  Vehicle,
  WarehouseLocation,
} from "./types";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { useConnectionStore } from "@/stores/connection-store";

type Notice = { tone: "success" | "error"; text: string };

export default function Page() {
  const { reconnect, subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const connected = useConnectionStore((state) => state.connected);
  const connecting = useConnectionStore((state) => state.connecting);
  const reconnecting = useConnectionStore((state) => state.reconnecting);

  // ── Mode: real-time by default; simulation is an opt-in testing tool ──────────────
  const [simulationOn, setSimulationOn] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(true);
  const [autoDispatch, setAutoDispatch] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────────────
  const returns = useReturnPickups();
  const fleet = useFleetQuery({ pollMs: simulationOn ? false : FLEET_POLL_MS });
  const live = useLivePositions(!simulationOn);
  const now = useNow();
  const { assignVehicleWarehouse, dispatchDelivery, changePaymentArrangement } =
    useFleetMutations();

  const warehouses = fleet.data?.warehouses ?? EMPTY_WAREHOUSES;

  // Server data is the source of truth; local state exists for optimistic edits and,
  // in simulation mode, the animation.
  const [vehicles, setVehicles] = useState<Vehicle[]>(
    () => fleet.data?.vehicles ?? [],
  );
  const [syncedFleet, setSyncedFleet] = useState(fleet.data);
  if (fleet.data !== syncedFleet) {
    setSyncedFleet(fleet.data);
    if (fleet.data) {
      const serverVehicles = fleet.data.vehicles;
      setVehicles((current) =>
        syncVehicles(current, serverVehicles, simulationOn),
      );
    }
  }

  useFleetSimulation({
    setVehicles,
    enabled: simulationOn && simulationRunning,
    autoDispatch,
  });

  useEffect(() => {
    return subscribe(REQUESTS.DRIVER_LOCATION_UPDATE, () => {
      void queryClient.invalidateQueries({ queryKey: fleetKeys.positions });
    });
  }, [queryClient, subscribe]);

  // ── UI state ─────────────────────────────────────────────────────────────────────
  const mapRef = useRef<MapRef>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("vehicles");
  const [panelTab, setPanelTab] = useState<PanelTab>("current");
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const [previewTripId, setPreviewTripId] = useState<string | null>(null);
  const [focusedWarehouseId, setFocusedWarehouseId] = useState<string | null>(
    null,
  );
  const [follow, setFollow] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [view, setView] = useState<FleetView>("split");
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setExpanded(false);
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[aria-label="Expand workspace"]')?.focus());
    }
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [expanded]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedId) ?? null;
  const previewTrip =
    selectedVehicle && previewTripId
      ? (() => {
          const trip = selectedVehicle.scheduledTrips.find((t) => t.id === previewTripId);
          return trip ? { trip, vehicle: selectedVehicle } : null;
        })()
      : null;
  const roadRoutes = useRoadRoutes(vehicles, warehouses, selectedId, previewTrip, live.positions, simulationOn, now);
  const vehicleRoadRoutes = roadRoutes.byVehicle;

  // Where every vehicle is drawn, and how much to trust it.
  const positions = useMemo(
    () =>
      new Map(
        vehicles.map((vehicle) => [
          vehicle.id,
          resolveVehiclePosition(
            vehicle,
            warehouses,
            live.positions.get(vehicle.id),
            simulationOn,
            now,
            vehicleRoadRoutes.get(vehicle.id),
          ),
        ]),
      ),
    [vehicles, warehouses, live.positions, simulationOn, now, vehicleRoadRoutes],
  );

  const selectedPosition = selectedVehicle
    ? positions.get(selectedVehicle.id)
    : undefined;
  const selectedLng = selectedPosition?.coordinates[0];
  const selectedLat = selectedPosition?.coordinates[1];

  // "Follow" keeps the camera on the selected vehicle as its position updates.
  useEffect(() => {
    if (!follow || selectedLng === undefined || selectedLat === undefined) {
      return;
    }
    mapRef.current?.easeTo({
      center: [selectedLng, selectedLat],
      duration: 900,
    });
  }, [follow, selectedLng, selectedLat]);

  // Toasts disappear on their own.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Every hook is above this point, so early returns are safe.
  if (fleet.isPending && !fleet.data) return <FleetMapLoading />;
  if (!fleet.data) {
    return (
      <FleetMapError
        message={
          fleet.error
            ? getErrorMessage(fleet.error)
            : "The fleet service returned no data."
        }
        onRetry={() => void fleet.refetch()}
      />
    );
  }

  // ── Derived ──────────────────────────────────────────────────────────────────────
  const counts = {
    delivering: vehicles.filter((v) => v.status === "delivering").length,
    returning: vehicles.filter((v) => v.status === "returning").length,
    available: vehicles.filter(isAvailableVehicle).length,
  };

  // ── Actions ──────────────────────────────────────────────────────────────────────
  function selectVehicle(vehicle: Vehicle) {
    setSelectedId(vehicle.id);
    setPanelTab("current");
    setExpandedStopId(null);
    setPreviewTripId(null);
    setFocusedWarehouseId(null);
    setMobileListOpen(false);

    const position = positions.get(vehicle.id);
    if (position) {
      mapRef.current?.easeTo({
        center: position.coordinates,
        zoom: 14,
        duration: 800,
      });
    }
  }

  function closePanel() {
    setSelectedId(null);
    setPreviewTripId(null);
    setFollow(false);
  }

  function focusWarehouse(warehouse: WarehouseLocation) {
    setView(current => current === "list" ? "split" : current);
    setFocusedWarehouseId(warehouse.id);
    setMobileListOpen(false);
    requestAnimationFrame(() => mapRef.current?.easeTo({
      center: warehouse.coordinates,
      zoom: 14,
      duration: 800,
    }));
  }

  function fitPoints(points: [number, number][]) {
    const map = mapRef.current;
    const bounds = getBounds(points);
    if (!map || !bounds) return;

    setFollow(false);
    requestAnimationFrame(() => map.fitBounds(bounds, {
      padding: {
        top: 90,
        bottom: 90,
        left: 60,
        right: 60,
      },
      maxZoom: 14,
      duration: 800,
    }));
  }

  function fitSelectedRoute() {
    if (!selectedVehicle) return;
    setView(current => current === "list" ? "split" : current);
    const points = [
      ...(vehicleRoadRoutes.get(selectedVehicle.id)?.coordinates ?? []),
      ...(simulationOn
        ? [getWarehouse(selectedVehicle, warehouses).coordinates, ...selectedVehicle.stops.map((stop) => stop.coordinates)]
        : liveRoutePoints(selectedVehicle, warehouses, positions.get(selectedVehicle.id))),
    ];
    const position = positions.get(selectedVehicle.id);
    if (position && (simulationOn || position.signal !== "none")) points.push(position.coordinates);
    fitPoints(points);
  }

  function previewTripOnMap(tripId: string | null) {
    if (tripId) setView(current => current === "list" ? "split" : current);
    setPreviewTripId(tripId);
    const trip = selectedVehicle?.scheduledTrips.find((t) => t.id === tripId);
    if (selectedVehicle && trip) {
      fitPoints([
        ...(simulationOn
          ? [getWarehouse(selectedVehicle, warehouses).coordinates, ...trip.stops.map((stop) => stop.coordinates)]
          : liveRoutePoints(selectedVehicle, warehouses, positions.get(selectedVehicle.id), trip)),
      ]);
    }
  }

  function changeSimulation(next: boolean) {
    setSimulationOn(next);
    if (next) return;

    // Back to real data: drop every simulated change and reload from the server.
    setSimulationRunning(true);
    setAutoDispatch(false);
    if (fleet.data) setVehicles(fleet.data.vehicles);
    void fleet.refetch();
  }

  function dispatchTrip(vehicle: Vehicle, tripId: string) {
    if (vehicle.status !== "available" || vehicle.blockedReason || dispatchDelivery.isPending) return;

    if (simulationOn) setVehicles((current) => current.map((item) => item.id === vehicle.id ? dispatchNextTrip(item, tripId) : item));
    setPreviewTripId(null);
    setPanelTab("current");

    // Simulation is a sandbox: nothing it does is saved.
    if (simulationOn) return;

    dispatchDelivery.mutate(tripId, {
      onSuccess: () =>
        setNotice({
          tone: "success",
          text: `Trip dispatched for ${vehicle.plate}.`,
        }),
      onError: (error) =>
        setNotice({ tone: "error", text: getErrorMessage(error) }),
    });
  }

  function assignWarehouse(vehicle: Vehicle, warehouseId: string) {
    if (!isAvailableVehicle(vehicle)) return;

    setVehicles((current) =>
      current.map((item) =>
        item.id === vehicle.id ? { ...item, warehouseId } : item,
      ),
    );
    if (simulationOn) return;
    assignVehicleWarehouse.mutate(
      { vehicleId: vehicle.id, warehouseId },
      {
        onError: (error) =>
          setNotice({ tone: "error", text: getErrorMessage(error) }),
      },
    );
  }

  function updatePaymentArrangement(
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
    changePaymentArrangement.mutate(
      { orderNumber: orderId, paymentArrangement: arrangement },
      {
        onError: (error) =>
          setNotice({ tone: "error", text: getErrorMessage(error) }),
      },
    );
  }

  const sidebar = (
    <Sidebar
      returnPickups={simulationOn ? [] : returns.data ?? []}
      returnsLoading={returns.isPending}
      returnsError={returns.isError}
      onRetryReturns={() => { void returns.refetch(); }}
      onFocusReturn={point => {
        closePanel();
        setMobileListOpen(false);
        setView(current => current === "list" ? "split" : current);
        requestAnimationFrame(() => mapRef.current?.flyTo({ center: point, zoom: 14 }));
      }}
      simulationOn={simulationOn}
      tab={sidebarTab}
      onTabChange={setSidebarTab}
      vehicles={vehicles}
      warehouses={warehouses}
      positions={positions}
      selectedId={selectedId}
      focusedWarehouseId={focusedWarehouseId}
      onSelectVehicle={selectVehicle}
      onFocusWarehouse={focusWarehouse}
    />
  );

  return (
    <div
      aria-label="Fleet workspace"
      role="region"
      className="relative flex h-[calc(100dvh-var(--header-height)-1rem)] min-h-[480px] w-full flex-col overflow-hidden rounded-xl border bg-background text-foreground"
      style={expanded ? { position: "fixed", inset: 0, zIndex: 50, height: "100dvh", minHeight: 0, maxWidth: "none", borderRadius: 0 } : undefined}
    >
        <Topbar
          view={view}
          onViewChange={(nextView) => { setView(nextView); setMobileListOpen(false); }}
          expanded={expanded}
          onToggleExpanded={() => setExpanded(current => !current)}
          simulationOn={simulationOn}
          feedError={fleet.isError}
          gpsError={live.isError}
          realtimeStatus={
            connected
              ? "connected"
              : connecting
                ? "connecting"
                : reconnecting
                  ? "reconnecting"
                  : "disconnected"
          }
          feedUpdatedAt={fleet.dataUpdatedAt}
          gpsUpdatedAt={live.updatedAt}
          now={now}
          counts={counts}
          onOpenList={() => setMobileListOpen(true)}
          onRetry={() => {
            void fleet.refetch();
            void live.refetch();
          }}
          onReconnect={reconnect}
          tools={
            <SimulationControls
              enabled={simulationOn}
              onEnabledChange={changeSimulation}
              running={simulationRunning}
              onRunningChange={setSimulationRunning}
              autoDispatch={autoDispatch}
              onAutoDispatchChange={setAutoDispatch}
            />
          }
        />

      <div className="@container relative flex min-h-0 flex-1 overflow-hidden">
      {/* Desktop sidebar */}
      <aside aria-label="Fleet list" className={cn("min-h-0 border-r", view === "list" ? "min-w-0 flex-1" : view === "map" ? "hidden" : "hidden w-[320px] shrink-0 lg:block xl:w-[360px]")}>
        {sidebar}
      </aside>

      {/* Mobile list overlay */}
      {mobileListOpen && view === "split" ? (
        <div className="absolute inset-0 z-30 flex flex-col bg-background lg:hidden">
          <div className="flex justify-end border-b p-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setMobileListOpen(false)}
              className="gap-1.5"
            >
              <X className="size-4" />
              Close
            </Button>
          </div>
          <div className="min-h-0 flex-1">{sidebar}</div>
        </div>
      ) : null}

      <div aria-label="Fleet map" className={cn("relative min-w-0 flex-1", view === "list" && "hidden")}>
        <FleetMapCanvas
          returnPickups={simulationOn ? [] : returns.data ?? []}
          mapRef={mapRef}
          vehicles={vehicles}
          warehouses={warehouses}
          positions={positions}
          selectedId={selectedId}
          previewTrip={previewTrip}
          roadRoutes={vehicleRoadRoutes}
          previewRoute={roadRoutes.preview}
          simulationOn={simulationOn}
          focusedWarehouseId={focusedWarehouseId}
          onSelectVehicle={selectVehicle}
          onFocusWarehouse={focusWarehouse}
        />

        {!simulationOn && selectedVehicle && selectedPosition?.signal === "none" && (
          <div role="status" className="absolute bottom-16 left-3 z-10 max-w-[75%] rounded-md border bg-background/95 px-3 py-2 text-sm shadow-sm">
            Waiting for vehicle GPS to draw a route.
          </div>
        )}
        {roadRoutes.isPending || roadRoutes.isError ? (
          <div role="status" className="absolute bottom-4 left-3 z-10 flex max-w-[75%] items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-sm">
            {roadRoutes.isError ? "Some road routes are unavailable." : "Loading road routes..."}
            {roadRoutes.isError ? (
              <button type="button" className="font-semibold underline" onClick={roadRoutes.retry}>Retry</button>
            ) : null}
          </div>
        ) : null}

        {simulationOn ? (
          <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-800 shadow-sm backdrop-blur dark:text-violet-200">
            <FlaskConical className="size-3.5" />
            Simulation: vehicle positions are not real
            <button
              type="button"
              onClick={() => changeSimulation(false)}
              className="rounded-full bg-violet-600 px-2 py-0.5 text-white hover:bg-violet-700"
            >
              Back to live
            </button>
          </div>
        ) : null}

      </div>
        {selectedVehicle && selectedPosition ? (
          <div className="absolute inset-x-2 bottom-2 z-20 h-[70%] min-h-0 shrink-0 @3xl:inset-y-2 @3xl:left-auto @3xl:h-auto @3xl:w-[360px] @5xl:relative @5xl:inset-auto @5xl:h-full @5xl:border-l @5xl:p-2">
            <VehiclePanel
              vehicle={selectedVehicle}
              warehouse={getWarehouse(selectedVehicle, warehouses)}
              warehouses={warehouses}
              position={selectedPosition}
              simulationOn={simulationOn}
              tab={panelTab}
              onTabChange={setPanelTab}
              expandedStopId={expandedStopId}
              onToggleStop={(stopId) =>
                setExpandedStopId((current) =>
                  current === stopId ? null : stopId,
                )
              }
              previewTripId={previewTripId}
              onPreviewTrip={previewTripOnMap}
              follow={follow}
              onFollowChange={(nextFollow) => { setFollow(nextFollow); if (nextFollow) setView(current => current === "list" ? "split" : current); }}
              onFitTrip={fitSelectedRoute}
              onClose={closePanel}
              onDispatch={(tripId) => dispatchTrip(selectedVehicle, tripId)}
              onAssignWarehouse={(warehouseId) =>
                assignWarehouse(selectedVehicle, warehouseId)
              }
              onPaymentChange={updatePaymentArrangement}
            />
          </div>
        ) : null}

        {notice ? (
          <div
            role="status"
            className={cn(
              "absolute bottom-4 left-1/2 z-30 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg",
              notice.tone === "success"
                ? "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                : "border-destructive/40 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
            )}
          >
            {notice.tone === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            {notice.text}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setNotice(null)}
              className="ml-1 rounded p-0.5 hover:bg-black/10"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
