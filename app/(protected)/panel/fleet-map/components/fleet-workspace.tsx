"use client";

import "../fleet-map.css";
import { useQueryClient } from "@tanstack/react-query";
import { PanelLeftOpen, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "@/components/ui/map";
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
import {
  compareVehicles,
  computeFleetCounts,
  isAvailableVehicle,
  matchesFilter,
  matchesSearch,
} from "../lib/vehicle";
import type {
  Coordinates,
  DeliveryStop,
  FollowMode,
  MapLayers,
  Vehicle,
  VehicleFilter,
  VehicleSortKey,
  WarehouseLocation,
  WorkspaceMode,
} from "../types";
import { DirectoryRail, type DirectoryTab } from "./directory-rail";
import { FleetMapError, FleetMapLoading } from "./fleet-map-status";
import { FleetTable } from "./fleet-table";
import { FleetMapCanvas } from "./map-canvas";
import { AssignPickupDialog, useReturnPickups } from "./return-pickups";
import { SimulationControls } from "./simulation-controls";
import { Topbar } from "./topbar";
import { VehicleInspector, type InspectorTab } from "./vehicle-inspector";

type Notice = { tone: "success" | "error"; text: string };
const EMPTY_VEHICLES: Vehicle[] = [];

export function FleetWorkspace() {
  const { reconnect, subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const userRole = useAuthStore((state) => state.user?.role);
  const connected = useConnectionStore((state) => state.connected);
  const connecting = useConnectionStore((state) => state.connecting);
  const reconnecting = useConnectionStore((state) => state.reconnecting);

  // Sandbox testing mode
  const [simulationOn, setSimulationOn] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(true);
  const [autoDispatch, setAutoDispatch] = useState(false);

  // Server queries
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

  // Workspace UI state
  const mapRef = useRef<MapRef>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<WorkspaceMode>("map");
  const [railOpen, setRailOpen] = useState(true);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [directoryTab, setDirectoryTab] = useState<DirectoryTab>("vehicles");
  const [selectedReturnId, setSelectedReturnId] = useState<number | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("trip");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  const [previewTripId, setPreviewTripId] = useState<string | null>(null);
  const [focusedWarehouseId, setFocusedWarehouseId] = useState<string | null>(
    null,
  );
  const [followMode, setFollowMode] = useState<FollowMode>("off");
  const [fullscreen, setFullscreen] = useState(false);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_MAP_LAYERS);

  // Search, filter, sort
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VehicleFilter>("all");
  const [sortKey, setSortKey] = useState<VehicleSortKey>("priority");

  // Mutation feedback
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

  const visibleVehicles = useMemo(
    () =>
      vehicles
        .filter(
          (v) =>
            matchesFilter(v, filter, positions.get(v.id)) &&
            matchesSearch(v, query, warehouses),
        )
        .sort((a, b) => compareVehicles(a, b, sortKey, positions)),
    [vehicles, filter, positions, query, warehouses, sortKey],
  );

  const selectedPosition = selectedVehicle
    ? positions.get(selectedVehicle.id)
    : undefined;
  const selectedLng = selectedPosition?.coordinates[0];
  const selectedLat = selectedPosition?.coordinates[1];

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

  // Keyboard shortcuts: Esc closes overlays/selection/fullscreen; "/" focuses search
  useEffect(() => {
    const prevOverflow = fullscreen ? document.body.style.overflow : null;
    if (fullscreen) {
      document.body.style.overflow = "hidden";
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (event.key === "/" && !typing && !document.querySelector('[role="dialog"]')) {
        event.preventDefault();
        setDirectoryTab("vehicles");
        setSelectedId(null);
        setRailOpen(true);
        setMobileRailOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }

      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"]')) return;

      if (mobileRailOpen) {
        setMobileRailOpen(false);
        return;
      }
      if (selectedId) {
        setSelectedId(null);
        setPreviewTripId(null);
        setFocusedStopId(null);
        setFollowMode("off");
        return;
      }
      if (fullscreen) {
        setFullscreen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (prevOverflow !== null) {
        document.body.style.overflow = prevOverflow;
      }
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen, mobileRailOpen, selectedId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
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
      return { top: 64, bottom: 64, left: 64, right: 64 };
    }
    const width = window.innerWidth;
    if (width >= 1024 && railOpen && mode === "map") {
      return { top: 64, bottom: 64, left: 376, right: 64 };
    }
    if (width < 1024 && mobileRailOpen && mode === "map") {
      return { top: 64, bottom: 280, left: 32, right: 32 };
    }
    return { top: 64, bottom: 64, left: 64, right: 64 };
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
        duration: 650,
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
        duration: 700,
      });
    });
  }

  function selectVehicle(vehicle: Vehicle) {
    setSelectedId(vehicle.id);
    setInspectorTab("trip");
    setFocusedStopId(null);
    setPreviewTripId(null);
    setFocusedWarehouseId(null);
    setStopActionError(null);
    setReturnError(null);

    if (mode === "map") {
      setRailOpen(true);
      setMobileRailOpen(true);
      const position = positions.get(vehicle.id);
      if (position && isValidCoordinate(position.coordinates)) {
        easeToPoint(position.coordinates, 12.5, 14);
      }
    }
  }

  function selectStop(vehicle: Vehicle, stop: DeliveryStop) {
    setSelectedId(vehicle.id);
    setInspectorTab("trip");
    setFocusedStopId(stop.id);
    setPreviewTripId(null);
    setFocusedWarehouseId(null);
    setFollowMode("off");
    if (mode === "map") {
      setRailOpen(true);
      setMobileRailOpen(true);
    }
    easeToPoint(stop.coordinates, 13.5, 15);
  }

  function closeInspector() {
    setSelectedId(null);
    setPreviewTripId(null);
    setFocusedStopId(null);
    setFollowMode("off");
    setStopActionError(null);
    setReturnError(null);
  }

  function stepSelectedVehicle(delta: -1 | 1) {
    if (!selectedVehicle) return;
    const pool = visibleVehicles.length > 0 ? visibleVehicles : vehicles;
    if (pool.length <= 1) return;
    const idx = pool.findIndex((v) => v.id === selectedVehicle.id);
    const nextIdx =
      idx === -1 ? 0 : (idx + delta + pool.length) % pool.length;
    selectVehicle(pool[nextIdx]);
  }

  function focusWarehouse(warehouse: WarehouseLocation) {
    setMode("map");
    setFocusedWarehouseId(warehouse.id);
    setMobileRailOpen(false);
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
      setNotice({ tone: "error", text: "No coordinates available to fit." });
      return;
    }
    fitPoints(points);
  }

  function fitSelectedRoute() {
    if (!selectedVehicle) return;
    setMode("map");
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
      setNotice({ tone: "error", text: "No coordinates for this route." });
      return;
    }
    fitPoints(points);
  }

  function recenterSelected() {
    if (!selectedVehicle) return;
    setMode("map");
    const position = positions.get(selectedVehicle.id);
    if (!position || !isValidCoordinate(position.coordinates)) return;
    easeToPoint(position.coordinates, 13, 14.5);
  }

  function previewTripOnMap(tripId: string | null) {
    if (tripId) setMode("map");
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
      setInspectorTab("trip");
      return;
    }

    dispatchDelivery.mutate(tripId, {
      onSuccess: () => {
        setPreviewTripId(null);
        setInspectorTab("trip");
        setNotice({
          tone: "success",
          text: `Dispatched ${vehicle.plate}.`,
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
            text: `Base updated for ${vehicle.plate}.`,
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
      setNotice({ tone: "success", text: "Stop marked delivered." });
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
        text: `Return confirmed for ${selectedVehicle.plate}.`,
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

  const showDevTools =
    process.env.NODE_ENV !== "production" || userRole === "admin";

  const canStepVehicles =
    (visibleVehicles.length > 0 ? visibleVehicles.length : vehicles.length) > 1;

  const inspectorNode =
    selectedVehicle && selectedPosition ? (
      <VehicleInspector
        vehicle={selectedVehicle}
        warehouse={getWarehouse(selectedVehicle, warehouses)}
        warehouses={warehouses}
        position={selectedPosition}
        roadRoute={vehicleRoadRoutes.get(selectedVehicle.id)}
        roadRouteError={roadRoutes.errorVehicles.has(selectedVehicle.id)}
        enrichmentByStopId={enrichment.byStopId}
        simulationOn={simulationOn}
        tab={inspectorTab}
        onTabChange={setInspectorTab}
        focusedStopId={focusedStopId}
        previewTripId={previewTripId}
        onPreviewTrip={previewTripOnMap}
        followMode={followMode}
        onFollowModeChange={(nextMode) => {
          setFollowMode(nextMode);
          if (nextMode === "active") {
            setMode("map");
            recenterSelected();
          }
        }}
        onRecenter={recenterSelected}
        onFitTrip={fitSelectedRoute}
        onFocusPoint={(coords) => {
          setMode("map");
          setFollowMode("off");
          setMobileRailOpen(false);
          easeToPoint(coords, 14, 15.5);
        }}
        onClose={closeInspector}
        onStepPrev={
          canStepVehicles ? () => stepSelectedVehicle(-1) : undefined
        }
        onStepNext={canStepVehicles ? () => stepSelectedVehicle(1) : undefined}
        showBackLabel={mode === "map"}
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
    ) : null;

  function handleFocusReturn(point: [number, number]) {
    closeInspector();
    setMobileRailOpen(false);
    setMode("map");
    easeToPoint(point, 13.5, 15);
  }

  const directoryProps = {
    tab: directoryTab,
    onTabChange: setDirectoryTab,
    vehicles,
    visibleVehicles,
    warehouses,
    returnPickups: simulationOn ? [] : (returns.data ?? []),
    returnsLoading: returns.isPending,
    returnsError: returns.isError,
    onRetryReturns: () => void returns.refetch(),
    simulationOn,
    positions,
    counts,
    stopEnrichment: enrichment.byStopId,
    selectedId,
    focusedWarehouseId,
    query,
    onQueryChange: setQuery,
    filter,
    onFilterChange: setFilter,
    sortKey,
    onSortChange: setSortKey,
    onClearFilters: clearFilters,
    onSelectVehicle: selectVehicle,
    onFocusWarehouse: focusWarehouse,
    onFocusReturn: handleFocusReturn,
  };

  return (
    <div
      aria-label="Fleet map workspace"
      role="region"
      className={cn(
        "fm-workspace relative flex h-[calc(100dvh-var(--header-height)-1rem)] min-h-[540px] w-full flex-col overflow-hidden rounded-xl border bg-background text-foreground",
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
        mode={mode}
        onModeChange={(nextMode) => {
          setMode(nextMode);
          setMobileRailOpen(false);
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
        onJumpToAttention={() => {
          setDirectoryTab("vehicles");
          setFilter("gps_attention");
          closeInspector();
          setRailOpen(true);
          setMobileRailOpen(true);
        }}
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
        {/* Map Mode: Full-bleed map with floating collapsible left rail */}
        <div
          aria-label="Fleet map"
          className={cn(
            "relative min-w-0 flex-1",
            mode !== "map" && "hidden",
          )}
        >
          <FleetMapCanvas
            returnPickups={simulationOn ? [] : (returns.data ?? [])}
            onSelectReturn={(taskId) => {
              setDirectoryTab("returns");
              setRailOpen(true);
              setSelectedReturnId(taskId);
            }}
            mapRef={mapRef}
            mode={mode}
            fullscreen={fullscreen}
            railOpen={railOpen}
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
            onSelectVehicle={selectVehicle}
            onSelectStop={selectStop}
            onFocusWarehouse={focusWarehouse}
          />

          {/* Desktop Floating Left Rail (Directory OR Drill-in Vehicle Inspector) */}
          {railOpen ? (
            <aside
              aria-label={selectedVehicle ? "Vehicle details" : "Fleet list"}
              className="fm-panel-enter absolute bottom-3 left-3 top-3 z-20 hidden w-[340px] flex-col overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur-md lg:flex"
            >
              {inspectorNode ?? (
                <DirectoryRail
                  {...directoryProps}
                  onCollapse={() => setRailOpen(false)}
                  searchInputRef={searchInputRef}
                />
              )}
            </aside>
          ) : (
            <button
              type="button"
              onClick={() => setRailOpen(true)}
              aria-label="Show fleet panel"
              className="fm-panel-enter absolute left-3 top-3 z-20 hidden h-9 items-center gap-2 rounded-lg border bg-background/95 px-3 text-xs font-medium shadow-sm backdrop-blur-md transition-colors hover:bg-accent lg:inline-flex"
            >
              <PanelLeftOpen className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Fleet</span>
              <span className="tabular-nums text-muted-foreground">
                {counts.total}
              </span>
            </button>
          )}

          {/* Mobile Trigger Pill */}
          {!mobileRailOpen ? (
            <button
              type="button"
              onClick={() => setMobileRailOpen(true)}
              className="absolute left-3 top-3 z-20 inline-flex h-8 items-center gap-2 rounded-lg border bg-background/95 px-3 text-xs font-medium shadow-sm backdrop-blur-md lg:hidden"
            >
              <PanelLeftOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>
                {selectedVehicle ? selectedVehicle.plate : `Fleet · ${counts.total}`}
              </span>
            </button>
          ) : null}

          {/* Mobile Bottom Sheet Rail */}
          {mobileRailOpen ? (
            <aside
              aria-label={selectedVehicle ? "Vehicle details" : "Fleet list"}
              className="fm-panel-enter absolute inset-x-2 bottom-2 z-20 flex h-[62%] flex-col overflow-hidden rounded-xl border bg-background shadow-xl lg:hidden"
            >
              {inspectorNode ?? (
                <DirectoryRail
                  {...directoryProps}
                  onCollapse={() => setMobileRailOpen(false)}
                />
              )}
            </aside>
          ) : null}

          {/* Subtle Bottom-Center Status Chips (Route status / Simulation) */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
            {!simulationOn &&
            selectedVehicle &&
            selectedVehicle.status !== "available" &&
            selectedPosition?.signal === "none" ? (
              <div
                role="status"
                className="pointer-events-auto rounded-full border bg-background/95 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md"
              >
                Waiting for GPS fix to draw route
              </div>
            ) : null}

            {layers.routes && (roadRoutes.isPending || roadRoutes.isError) ? (
              <div
                role="status"
                className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md"
              >
                <span>
                  {roadRoutes.isError
                    ? "Road routing unavailable"
                    : "Updating routes…"}
                </span>
                {roadRoutes.isError ? (
                  <button
                    type="button"
                    className="font-semibold text-primary hover:underline"
                    onClick={roadRoutes.retry}
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}

            {simulationOn ? (
              <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-violet-300 bg-violet-50/95 py-1 pl-3 pr-1.5 text-[11px] font-medium text-violet-900 shadow-sm backdrop-blur-md dark:border-violet-800 dark:bg-violet-950/95 dark:text-violet-200">
                <span>Simulation active</span>
                <button
                  type="button"
                  onClick={() => changeSimulation(false)}
                  className="rounded-full bg-violet-700 px-2 py-0.5 text-[11px] text-white hover:bg-violet-800"
                >
                  Exit
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Table Mode: Full-width responsive table + optional slide-over inspector */}
        {mode === "table" ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <FleetTable
              tab={directoryTab}
              onTabChange={setDirectoryTab}
              vehicles={vehicles}
              visibleVehicles={visibleVehicles}
              warehouses={warehouses}
              returnPickups={simulationOn ? [] : (returns.data ?? [])}
              returnsLoading={returns.isPending}
              returnsError={returns.isError}
              onRetryReturns={() => void returns.refetch()}
              simulationOn={simulationOn}
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
              onSelectVehicle={selectVehicle}
              onFocusWarehouse={focusWarehouse}
              onFocusReturn={(point) => {
                closeInspector();
                setMode("map");
                easeToPoint(point, 13.5, 15);
              }}
              searchInputRef={searchInputRef}
            />

            {inspectorNode ? (
              <aside
                aria-label="Vehicle details"
                className="fm-panel-enter absolute inset-y-0 right-0 z-20 w-full max-w-[360px] border-l bg-background shadow-xl @4xl:relative @4xl:shadow-none"
              >
                {inspectorNode}
              </aside>
            ) : null}
          </div>
        ) : null}

        {/* Non-blocking operation notice */}
        {notice ? (
          <div
            role="status"
            className={cn(
              "fm-panel-enter absolute bottom-4 right-4 z-30 flex max-w-xs items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-md",
              notice.tone === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                : "border-destructive/40 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
            )}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setNotice(null)}
              className="rounded p-0.5 opacity-70 hover:opacity-100"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      {selectedReturnId !== null &&
        (() => {
          const picked = (returns.data ?? []).find(
            (item) => item.id === selectedReturnId,
          );
          return picked ? (
            <AssignPickupDialog
              key={`map-return-${picked.id}`}
              task={picked}
              onClose={() => setSelectedReturnId(null)}
            />
          ) : null;
        })()}
    </div>
  );
}
