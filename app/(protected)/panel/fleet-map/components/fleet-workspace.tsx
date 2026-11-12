"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FlaskConical, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "@/components/ui/map";
import { Button } from "@/components/ui/button";
import { REQUESTS } from "@/constant/request";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useConnectionStore } from "@/stores/connection-store";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { getErrorMessage } from "../api-client";
import {
  DEFAULT_MAP_LAYERS,
  EMPTY_WAREHOUSES,
  FLEET_POLL_MS,
} from "../constants";
import { useDeliveryEnrichment } from "../hooks/use-delivery-enrichment";
import { useFleetMutations } from "../hooks/use-fleet-mutations";
import { fleetKeys, useFleetQuery } from "../hooks/use-fleet-query";
import { useFleetSimulation } from "../hooks/use-fleet-simulation";
import { useLivePositions } from "../hooks/use-live-positions";
import { useNow } from "../hooks/use-now";
import { useRoadRoutes } from "../hooks/use-road-routes";
import { getBounds, getWarehouse, isValidCoordinate } from "../lib/geometry";
import { resolveVehiclePosition } from "../lib/live";
import { liveRoutePoints } from "../lib/live-route";
import { dispatchNextTrip, syncVehicles } from "../lib/simulation";
import { computeFleetCounts, isAvailableVehicle } from "../lib/vehicle";
import type {
  Coordinates,
  DeliveryStop,
  FleetView,
  FollowMode,
  MapLayers,
  Vehicle,
  VehicleFilter,
  VehicleSortKey,
  WarehouseLocation,
} from "../types";
import { FleetMapError, FleetMapLoading } from "./fleet-map-status";
import { FleetMapCanvas } from "./map-canvas";
import { useReturnPickups } from "./return-pickups";
import { Sidebar, type SidebarTab } from "./sidebar";
import { SimulationControls } from "./simulation-controls";
import { Topbar } from "./topbar";
import { VehiclePanel, type PanelTab } from "./vehicle-panel";

type Notice = { tone: "success" | "error"; text: string };
const EMPTY_VEHICLES: Vehicle[] = [];

export function FleetWorkspace() {
  const { reconnect, subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const userRole = useAuthStore((state) => state.user?.role);
  const connected = useConnectionStore((state) => state.connected);
  const connecting = useConnectionStore((state) => state.connecting);
  const reconnecting = useConnectionStore((state) => state.reconnecting);

  // Sandbox testing mode (off by default; live backend data is the source of truth)
  const [simulationOn, setSimulationOn] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(true);
  const [autoDispatch, setAutoDispatch] = useState(false);

  // Server Queries
  const returns = useReturnPickups();
  const fleet = useFleetQuery({ pollMs: simulationOn ? false : FLEET_POLL_MS });
  const live = useLivePositions(!simulationOn);
  const enrichment = useDeliveryEnrichment(!simulationOn);
  const now = useNow();

  const {
    assignVehicleWarehouse,
    dispatchDelivery,
    markStopDelivered,
    completeDelivery,
  } = useFleetMutations();

  const warehouses = fleet.data?.warehouses ?? EMPTY_WAREHOUSES;
  const serverVehicles = fleet.data?.vehicles ?? EMPTY_VEHICLES;

  const [simVehicles, setSimVehicles] = useState<Vehicle[]>([]);

  useFleetSimulation({
    setVehicles: setSimVehicles,
    enabled: simulationOn && simulationRunning,
    autoDispatch,
  });

  const vehicles = useMemo(
    () =>
      simulationOn
        ? syncVehicles(simVehicles, serverVehicles, true)
        : serverVehicles,
    [simulationOn, simVehicles, serverVehicles],
  );

  useEffect(() => {
    return subscribe(REQUESTS.DRIVER_LOCATION_UPDATE, () => {
      void queryClient.invalidateQueries({ queryKey: fleetKeys.positions });
    });
  }, [queryClient, subscribe]);

  // Workspace UI State (preserved across view mode switches)
  const mapRef = useRef<MapRef>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("vehicles");
  const [panelTab, setPanelTab] = useState<PanelTab>("current");
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const [previewTripId, setPreviewTripId] = useState<string | null>(null);
  const [focusedWarehouseId, setFocusedWarehouseId] = useState<string | null>(
    null,
  );
  const [followMode, setFollowMode] = useState<FollowMode>("off");
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [view, setView] = useState<FleetView>("split");
  const [fullscreen, setFullscreen] = useState(false);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_MAP_LAYERS);

  // Search, Filter & Sort State
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VehicleFilter>("all");
  const [sortKey, setSortKey] = useState<VehicleSortKey>("priority");

  // Mutation UX Feedback
  const [notice, setNotice] = useState<Notice | null>(null);
  const [savingStopId, setSavingStopId] = useState<string | null>(null);
  const [stopActionError, setStopActionError] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  const selectedVehicle = vehicles.find((v) => v.id === selectedId) ?? null;

  const previewTrip =
    selectedVehicle && previewTripId
      ? (() => {
          const trip = selectedVehicle.scheduledTrips.find(
            (t) => t.id === previewTripId,
          );
          return trip ? { trip, vehicle: selectedVehicle } : null;
        })()
      : null;

  const roadRoutes = useRoadRoutes(
    vehicles,
    warehouses,
    selectedId,
    previewTrip,
    live.positions,
    simulationOn,
    now,
    layers.routes,
  );
  const vehicleRoadRoutes = roadRoutes.byVehicle;

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
    [
      vehicles,
      warehouses,
      live.positions,
      simulationOn,
      now,
      vehicleRoadRoutes,
    ],
  );

  const selectedPosition = selectedVehicle
    ? positions.get(selectedVehicle.id)
    : undefined;
  const selectedLng = selectedPosition?.coordinates[0];
  const selectedLat = selectedPosition?.coordinates[1];

  // Follow updates camera position gently only while active.
  useEffect(() => {
    if (
      followMode !== "active" ||
      selectedLng === undefined ||
      selectedLat === undefined ||
      !isValidCoordinate([selectedLng, selectedLat])
    ) {
      return;
    }
    mapRef.current?.easeTo({
      center: [selectedLng, selectedLat],
      duration: 800,
    });
  }, [followMode, selectedLng, selectedLat]);

  // Escape hierarchy: nested Dialog (Radix handles itself) -> mobile list -> details drawer -> fullscreen
  useEffect(() => {
    if (fullscreen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        if (document.querySelector('[role="dialog"]')) return;
        if (mobileListOpen) {
          setMobileListOpen(false);
          return;
        }
        if (selectedId) {
          setSelectedId(null);
          setPreviewTripId(null);
          setFollowMode("off");
          return;
        }
        setFullscreen(false);
      };
      window.addEventListener("keydown", onKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener("keydown", onKeyDown);
      };
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (mobileListOpen) {
        setMobileListOpen(false);
        return;
      }
      if (selectedId) {
        setSelectedId(null);
        setPreviewTripId(null);
        setFollowMode("off");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, mobileListOpen, selectedId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

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

  const counts = computeFleetCounts(vehicles, positions);

  function cameraPadding() {
    if (typeof window === "undefined") {
      return { top: 80, bottom: 80, left: 60, right: 60 };
    }
    const width = window.innerWidth;
    if (width < 768 && selectedId) {
      return { top: 64, bottom: 260, left: 32, right: 32 };
    }
    if (width >= 768 && width < 1280 && selectedId) {
      return { top: 80, bottom: 80, left: 48, right: 390 };
    }
    return { top: 80, bottom: 80, left: 60, right: 60 };
  }

  function easeToPoint(point: Coordinates, minZoom = 13, maxZoom = 14.5) {
    const map = mapRef.current;
    if (!map || !isValidCoordinate(point)) return;
    const currentZoom = map.getZoom();
    const targetZoom = Math.min(Math.max(currentZoom, minZoom), maxZoom);
    requestAnimationFrame(() => {
      map.easeTo({
        center: point,
        zoom: targetZoom,
        padding: cameraPadding(),
        duration: 700,
      });
    });
  }

  function fitPoints(points: Coordinates[]) {
    const map = mapRef.current;
    const bounds = getBounds(points);
    if (!map || !bounds) return;

    setFollowMode("off");
    requestAnimationFrame(() => {
      map.fitBounds(bounds, {
        padding: cameraPadding(),
        maxZoom: 14,
        duration: 750,
      });
    });
  }

  function selectVehicle(vehicle: Vehicle) {
    setSelectedId(vehicle.id);
    setPanelTab("current");
    setExpandedStopId(null);
    setPreviewTripId(null);
    setFocusedWarehouseId(null);
    setMobileListOpen(false);
    setStopActionError(null);
    setReturnError(null);

    if (view !== "list") {
      const position = positions.get(vehicle.id);
      if (position && isValidCoordinate(position.coordinates)) {
        easeToPoint(position.coordinates, 12.5, 14);
      }
    }
  }

  function selectStop(vehicle: Vehicle, stop: DeliveryStop) {
    setSelectedId(vehicle.id);
    setPanelTab("current");
    setExpandedStopId(stop.id);
    setPreviewTripId(null);
    setFocusedWarehouseId(null);
    setMobileListOpen(false);
    setFollowMode("off");
    easeToPoint(stop.coordinates, 13.5, 15);
  }

  function closePanel() {
    setSelectedId(null);
    setPreviewTripId(null);
    setExpandedStopId(null);
    setFollowMode("off");
    setStopActionError(null);
    setReturnError(null);
  }

  function focusWarehouse(warehouse: WarehouseLocation) {
    setView((current) => (current === "list" ? "split" : current));
    setFocusedWarehouseId(warehouse.id);
    setMobileListOpen(false);
    setFollowMode("off");
    easeToPoint(warehouse.coordinates, 13, 14.5);
  }

  function fitFleet() {
    const knownVehiclePoints = vehicles.flatMap((v) => {
      const pos = positions.get(v.id);
      if (!pos || !isValidCoordinate(pos.coordinates)) return [];
      if (!simulationOn && pos.health === "none") return [];
      return [pos.coordinates];
    });
    const points =
      knownVehiclePoints.length > 0
        ? knownVehiclePoints
        : warehouses.map((w) => w.coordinates);
    if (points.length === 0) {
      setNotice({
        tone: "error",
        text: "No valid fleet or warehouse coordinates available to fit.",
      });
      return;
    }
    fitPoints(points);
  }

  function fitSelectedRoute() {
    if (!selectedVehicle) return;
    setView((current) => (current === "list" ? "split" : current));
    const points: Coordinates[] = [
      ...(vehicleRoadRoutes.get(selectedVehicle.id)?.coordinates ?? []),
      ...(simulationOn
        ? [
            getWarehouse(selectedVehicle, warehouses).coordinates,
            ...selectedVehicle.stops.map((stop) => stop.coordinates),
          ]
        : liveRoutePoints(
            selectedVehicle,
            warehouses,
            positions.get(selectedVehicle.id),
          )),
    ];
    const position = positions.get(selectedVehicle.id);
    if (position && (simulationOn || position.signal !== "none")) {
      points.push(position.coordinates);
    }
    if (points.length === 0) {
      setNotice({
        tone: "error",
        text: "No valid coordinates or GPS signal to fit this route.",
      });
      return;
    }
    fitPoints(points);
  }

  function recenterSelected() {
    if (!selectedVehicle) return;
    const position = positions.get(selectedVehicle.id);
    if (!position || !isValidCoordinate(position.coordinates)) return;
    easeToPoint(position.coordinates, 13, 14.5);
  }

  function previewTripOnMap(tripId: string | null) {
    if (tripId) setView((current) => (current === "list" ? "split" : current));
    setPreviewTripId(tripId);
    const trip = selectedVehicle?.scheduledTrips.find((t) => t.id === tripId);
    if (selectedVehicle && trip) {
      fitPoints([
        ...(simulationOn
          ? [
              getWarehouse(selectedVehicle, warehouses).coordinates,
              ...trip.stops.map((stop) => stop.coordinates),
            ]
          : liveRoutePoints(
              selectedVehicle,
              warehouses,
              positions.get(selectedVehicle.id),
              trip,
            )),
      ]);
    }
  }

  function changeSimulation(next: boolean) {
    setSimulationOn(next);
    if (next) {
      setSimVehicles(serverVehicles);
      return;
    }
    setSimulationRunning(true);
    setAutoDispatch(false);
    void fleet.refetch();
  }

  function dispatchTrip(vehicle: Vehicle, tripId: string) {
    if (
      vehicle.status !== "available" ||
      vehicle.blockedReason ||
      dispatchDelivery.isPending
    ) {
      return;
    }

    if (simulationOn) {
      setSimVehicles((current) =>
        current.map((item) =>
          item.id === vehicle.id ? dispatchNextTrip(item, tripId) : item,
        ),
      );
      setPreviewTripId(null);
      setPanelTab("current");
      return;
    }

    dispatchDelivery.mutate(tripId, {
      onSuccess: () => {
        setPreviewTripId(null);
        setPanelTab("current");
        setNotice({
          tone: "success",
          text: `Trip dispatched for ${vehicle.plate}.`,
        });
      },
      onError: (error) =>
        setNotice({ tone: "error", text: getErrorMessage(error) }),
    });
  }

  function assignWarehouse(vehicle: Vehicle, warehouseId: string) {
    if (!isAvailableVehicle(vehicle)) return;

    if (simulationOn) {
      setSimVehicles((current) =>
        current.map((item) =>
          item.id === vehicle.id ? { ...item, warehouseId } : item,
        ),
      );
      return;
    }

    assignVehicleWarehouse.mutate(
      { vehicleId: vehicle.id, warehouseId },
      {
        onSuccess: () =>
          setNotice({
            tone: "success",
            text: `Home warehouse updated for ${vehicle.plate}.`,
          }),
        onError: (error) =>
          setNotice({ tone: "error", text: getErrorMessage(error) }),
      },
    );
  }

  async function handleConfirmStopDelivered(stopId: string): Promise<boolean> {
    if (savingStopId || simulationOn) return false;
    setSavingStopId(stopId);
    setStopActionError(null);
    try {
      await markStopDelivered.mutateAsync(stopId);
      setNotice({
        tone: "success",
        text: "Stop marked delivered. Fleet status updated.",
      });
      return true;
    } catch (error) {
      setStopActionError(getErrorMessage(error));
      return false;
    } finally {
      setSavingStopId(null);
    }
  }

  async function handleCompleteReturn(): Promise<boolean> {
    if (!selectedVehicle?.trip || completeDelivery.isPending || simulationOn) {
      return false;
    }
    setReturnError(null);
    try {
      await completeDelivery.mutateAsync(selectedVehicle.trip.id);
      setNotice({
        tone: "success",
        text: `Warehouse return confirmed for ${selectedVehicle.plate}.`,
      });
      return true;
    } catch (error) {
      setReturnError(getErrorMessage(error));
      return false;
    }
  }

  function clearFilters() {
    setQuery("");
    setFilter("all");
  }

  function handleHeaderFilterSelect(nextFilter: VehicleFilter) {
    setSidebarTab("vehicles");
    setFilter((current) => (current === nextFilter ? "all" : nextFilter));
    if (view === "map") {
      setView("split");
    }
  }

  const showDevTools =
    process.env.NODE_ENV !== "production" || userRole === "admin";

  const sidebarContent = (layout: "sidebar" | "table") => (
    <Sidebar
      returnPickups={simulationOn ? [] : returns.data ?? []}
      returnsLoading={returns.isPending}
      returnsError={returns.isError}
      onRetryReturns={() => {
        void returns.refetch();
      }}
      onFocusReturn={(point) => {
        closePanel();
        setMobileListOpen(false);
        setView((current) => (current === "list" ? "split" : current));
        easeToPoint(point, 13.5, 15);
      }}
      simulationOn={simulationOn}
      tab={sidebarTab}
      onTabChange={setSidebarTab}
      vehicles={vehicles}
      warehouses={warehouses}
      positions={positions}
      counts={counts}
      stopEnrichment={enrichment.byStopId}
      selectedId={selectedId}
      focusedWarehouseId={focusedWarehouseId}
      query={query}
      onQueryChange={setQuery}
      filter={filter}
      onFilterChange={setFilter}
      sortKey={sortKey}
      onSortChange={setSortKey}
      onClearFilters={clearFilters}
      layout={layout}
      onSelectVehicle={selectVehicle}
      onFocusWarehouse={focusWarehouse}
    />
  );

  return (
    <div
      aria-label="Fleet dispatch workspace"
      role="region"
      className={cn(
        "relative flex h-[calc(100dvh-var(--header-height)-1rem)] min-h-[520px] w-full flex-col overflow-hidden rounded-xl border bg-background text-foreground",
        "[--primary:#1d4ed8] [--primary-foreground:#ffffff] [--ring:#1d4ed8] dark:[--primary:#2563eb] dark:[--primary-foreground:#ffffff] dark:[--ring:#3b82f6]",
      )}
      style={
        fullscreen
          ? {
              position: "fixed",
              inset: 0,
              zIndex: 50,
              height: "100dvh",
              minHeight: 0,
              maxWidth: "none",
              borderRadius: 0,
            }
          : undefined
      }
    >
      <Topbar
        view={view}
        onViewChange={(nextView) => {
          setView(nextView);
          setMobileListOpen(false);
        }}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((current) => !current)}
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
        activeFilter={filter}
        onFilterSelect={handleHeaderFilterSelect}
        onOpenList={() => setMobileListOpen(true)}
        onRetry={() => {
          void fleet.refetch();
          void live.refetch();
          void enrichment.refetch();
        }}
        onReconnect={reconnect}
        tools={
          showDevTools ? (
            <SimulationControls
              enabled={simulationOn}
              onEnabledChange={changeSimulation}
              running={simulationRunning}
              onRunningChange={setSimulationRunning}
              autoDispatch={autoDispatch}
              onAutoDispatchChange={setAutoDispatch}
            />
          ) : undefined
        }
      />

      <div className="@container relative flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar (Split mode) or Full-Width Operations Table (List Only mode) */}
        <aside
          aria-label="Fleet directory"
          className={cn(
            "min-h-0 border-r bg-background",
            view === "list"
              ? "min-w-0 flex-1 border-r-0"
              : view === "map"
                ? "hidden"
                : "hidden w-[320px] shrink-0 lg:block xl:w-[340px]",
          )}
        >
          {sidebarContent(view === "list" ? "table" : "sidebar")}
        </aside>

        {/* Mobile Fleet Sheet (Split mode below lg) */}
        {mobileListOpen && view === "split" ? (
          <div
            role="dialog"
            aria-label="Browse fleet"
            className="absolute inset-0 z-30 flex flex-col bg-background lg:hidden"
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Fleet directory</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setMobileListOpen(false)}
                className="h-8 gap-1.5"
              >
                <X className="size-4" aria-hidden="true" />
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1">{sidebarContent("sidebar")}</div>
          </div>
        ) : null}

        {/* Map Canvas */}
        <div
          aria-label="Fleet map"
          className={cn("relative min-w-0 flex-1", view === "list" && "hidden")}
        >
          <FleetMapCanvas
            returnPickups={simulationOn ? [] : returns.data ?? []}
            mapRef={mapRef}
            view={view}
            fullscreen={fullscreen}
            vehicles={vehicles}
            warehouses={warehouses}
            positions={positions}
            stopEnrichment={enrichment.byStopId}
            selectedId={selectedId}
            previewTrip={previewTrip}
            roadRoutes={vehicleRoadRoutes}
            previewRoute={roadRoutes.preview}
            simulationOn={simulationOn}
            focusedWarehouseId={focusedWarehouseId}
            followMode={followMode}
            layers={layers}
            onLayersChange={setLayers}
            onPauseFollow={() =>
              setFollowMode((current) =>
                current === "active" ? "paused" : current,
              )
            }
            onResumeFollow={() => {
              setFollowMode("active");
              recenterSelected();
            }}
            onStopFollow={() => setFollowMode("off")}
            onFitFleet={fitFleet}
            onFitRoute={fitSelectedRoute}
            onRecenterSelected={recenterSelected}
            onSelectVehicle={selectVehicle}
            onSelectStop={selectStop}
            onFocusWarehouse={focusWarehouse}
          />

          {/* Truthful Route / GPS Status Overlays */}
          {!simulationOn &&
          selectedVehicle &&
          selectedVehicle.status !== "available" &&
          selectedPosition?.signal === "none" ? (
            <div
              role="status"
              className="absolute bottom-14 left-3 z-10 max-w-[75%] rounded-md border bg-background px-3 py-2 text-xs shadow-sm"
            >
              Waiting for vehicle GPS fix to draw planned road route.
            </div>
          ) : null}

          {layers.routes && (roadRoutes.isPending || roadRoutes.isError) ? (
            <div
              role="status"
              className="absolute bottom-3 left-3 z-10 flex max-w-[75%] items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs shadow-sm"
            >
              <span>
                {roadRoutes.isError
                  ? "Road routing unavailable (no straight-line fallback shown)."
                  : "Calculating road routes…"}
              </span>
              {roadRoutes.isError ? (
                <button
                  type="button"
                  className="font-semibold text-primary underline"
                  onClick={roadRoutes.retry}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}

          {simulationOn ? (
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-violet-400 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-900 shadow-sm dark:border-violet-800 dark:bg-violet-950/90 dark:text-violet-200">
              <FlaskConical className="size-3.5" aria-hidden="true" />
              <span>Simulation mode (not real GPS)</span>
              <button
                type="button"
                onClick={() => changeSimulation(false)}
                className="rounded-full bg-violet-700 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-violet-800"
              >
                Exit simulation
              </button>
            </div>
          ) : null}
        </div>

        {/* Contextual Vehicle Details Drawer (Docked on wide, Overlay on medium, Bottom Sheet on mobile) */}
        {selectedVehicle && selectedPosition ? (
          <div className="absolute inset-x-2 bottom-2 z-20 h-[66%] min-h-0 shrink-0 @3xl:inset-y-2 @3xl:left-auto @3xl:right-2 @3xl:h-auto @3xl:w-[360px] @5xl:relative @5xl:inset-auto @5xl:h-full @5xl:w-[380px] @5xl:border-l @5xl:bg-background @5xl:p-2">
            <VehiclePanel
              vehicle={selectedVehicle}
              warehouse={getWarehouse(selectedVehicle, warehouses)}
              warehouses={warehouses}
              position={selectedPosition}
              roadRoute={vehicleRoadRoutes.get(selectedVehicle.id)}
              roadRouteError={roadRoutes.errorVehicles.has(selectedVehicle.id)}
              enrichmentByStopId={enrichment.byStopId}
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
              followMode={followMode}
              onFollowModeChange={(nextMode) => {
                setFollowMode(nextMode);
                if (nextMode === "active") {
                  setView((current) => (current === "list" ? "split" : current));
                  recenterSelected();
                }
              }}
              routesVisible={layers.routes}
              onToggleRoutesVisible={() =>
                setLayers((current) => ({ ...current, routes: !current.routes }))
              }
              onRecenter={recenterSelected}
              onFitTrip={fitSelectedRoute}
              onFocusPoint={(coords) => {
                setView((current) => (current === "list" ? "split" : current));
                setFollowMode("off");
                easeToPoint(coords, 14, 15.5);
              }}
              onClose={closePanel}
              onDispatch={(tripId) => dispatchTrip(selectedVehicle, tripId)}
              dispatching={dispatchDelivery.isPending}
              onAssignWarehouse={(warehouseId) =>
                assignWarehouse(selectedVehicle, warehouseId)
              }
              onConfirmStopDelivered={handleConfirmStopDelivered}
              savingStopId={savingStopId}
              stopActionError={stopActionError}
              onCompleteReturn={handleCompleteReturn}
              completingReturn={completeDelivery.isPending}
              returnError={returnError}
              onRetryRoute={roadRoutes.retry}
            />
          </div>
        ) : null}

        {/* Toast-like Inline Operation Feedback */}
        {notice ? (
          <div
            role="status"
            className={cn(
              "absolute bottom-4 left-1/2 z-30 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-lg",
              notice.tone === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                : "border-destructive/40 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
            )}
          >
            {notice.tone === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span>{notice.text}</span>
            <button
              type="button"
              aria-label="Dismiss notice"
              onClick={() => setNotice(null)}
              className="ml-1 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
