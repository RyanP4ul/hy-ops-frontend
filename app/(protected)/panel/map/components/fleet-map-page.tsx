"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map,
  MapControls,
  MapMarker,
  MapRef,
  MapRoute,
  MarkerContent,
  MarkerLabel,
  RouteMarker,
  RouteProgress,
  type MapViewport,
} from "@/components/ui/map";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Car,
  Check,
  ChevronsUpDown,
  LocateFixed,
  Trash2,
  Circle,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Coordinate, DEFAULT_LOCATION, Destination } from "@/types/geocode";
import { useFleetMap } from "../provider";
import ViewportDebug from "./viewport-debug";

const destinations: Destination[] = [
  {
    id: 1,
    name: "Balagtas Municipal Hall",
    description: "Balagtas, Bulacan",
    coordinate: [120.9077, 14.8165],
  },
  {
    id: 2,
    name: "Malolos",
    description: "Malolos, Bulacan",
    coordinate: [120.8117, 14.8527],
  },
  {
    id: 3,
    name: "Guiguinto",
    description: "Guiguinto, Bulacan",
    coordinate: [120.8779, 14.8339],
  },
  {
    id: 4,
    name: "Meycauayan",
    description: "Meycauayan, Bulacan",
    coordinate: [120.9608, 14.7368],
  },
];

export default function FleetMapPage() {
  const { viewport, setViewport, style, setStyle, selectedStyle, is3D } =
    useFleetMap();
  const mapRef = useRef<MapRef>(null);

  const [currentLocation, setCurrentLocation] =
    useState<Coordinate>(DEFAULT_LOCATION);

  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: Coordinate = [
          position.coords.longitude,
          position.coords.latitude,
        ];

        setCurrentLocation(location);
        setLocationLoading(false);

        mapRef.current?.easeTo({
          center: location,
          zoom: 14,
          duration: 800,
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationError(error.message);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  }, []);

  /*
   * ------------------------------------------------------------
   * DESTINATION COMBOBOX
   * ------------------------------------------------------------
   */

  const [open, setOpen] = useState(false);

  const [selectedDestinations, setSelectedDestinations] = useState<
    Destination[]
  >([]);

  /*
   * ------------------------------------------------------------
   * ACTIVE STOP
   * ------------------------------------------------------------
   *
   * 0 = current location / start
   * 1 = first destination
   * 2 = second destination
   * etc.
   */

  const [activeStop, setActiveStop] = useState(0);

  /*
   * ------------------------------------------------------------
   * ROUTE
   * ------------------------------------------------------------
   */

  const [route, setRoute] = useState<Coordinate[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  /*
   * Route progress is now derived from the selected stop.
   *
   * Start = 0%
   * Stop 1 = 1 / number of destinations
   * Stop 2 = 2 / number of destinations
   * etc.
   */

  const progress = useMemo(() => {
    if (selectedDestinations.length === 0) {
      return 0;
    }

    return activeStop / selectedDestinations.length;
  }, [activeStop, selectedDestinations.length]);

  /*
   * ------------------------------------------------------------
   * FETCH ROUTE
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!currentLocation || selectedDestinations.length === 0) {
      setRoute([]);
      setActiveStop(0);
      return;
    }

    const controller = new AbortController();

    async function fetchRoute() {
      try {
        setRouteLoading(true);
        setRouteError(null);

        const waypoints: Coordinate[] = [
          currentLocation,
          ...selectedDestinations.map((destination) => destination.coordinate),
        ];

        if (waypoints === null) {
          setRoute([]);
          return;
        }

        const coordinateString = waypoints
          .map(([lng, lat]) => `${lng},${lat}`)
          .join(";");

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${coordinateString}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch route.");
        }

        const data = await response.json();

        if (data.code !== "Ok" || !data.routes?.length) {
          throw new Error("No route was found.");
        }

        const coordinates = data.routes[0].geometry.coordinates as Coordinate[];

        setRoute(coordinates);

        const map = mapRef.current;

        if (map && coordinates.length > 0) {
          const lngs = coordinates.map(([lng]) => lng);
          const lats = coordinates.map(([, lat]) => lat);

          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);

          map.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            {
              padding: 80,
              duration: 800,
            },
          );
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error(error);

        setRouteError(
          error instanceof Error ? error.message : "Failed to load route.",
        );

        setRoute([]);
      } finally {
        setRouteLoading(false);
      }
    }

    fetchRoute();

    return () => controller.abort();
  }, [currentLocation, selectedDestinations]);

  /*
   * ------------------------------------------------------------
   * 3D MAP
   * ------------------------------------------------------------
   */

  useEffect(() => {
    mapRef.current?.easeTo({
      pitch: is3D ? 60 : 0,
      duration: 500,
    });
  }, [is3D]);

  /*
   * ------------------------------------------------------------
   * LOCATE ME
   * ------------------------------------------------------------
   */

  function locateMe() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: Coordinate = [
          position.coords.longitude,
          position.coords.latitude,
        ];

        setCurrentLocation(location);

        mapRef.current?.easeTo({
          center: location,
          zoom: 15,
          duration: 800,
        });
      },
      (error) => {
        console.error(error);
        setLocationError(error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  /*
   * ------------------------------------------------------------
   * DISPLAY LOCATION
   * ------------------------------------------------------------
   */

  const locationText = useMemo(() => {
    if (!currentLocation) {
      return "Waiting for location...";
    }

    return `${currentLocation[1].toFixed(5)}, ${currentLocation[0].toFixed(5)}`;
  }, [currentLocation]);

  /*
   * ------------------------------------------------------------
   * SELECT STOP
   * ------------------------------------------------------------
   */

  function selectStop(index: number) {
    setActiveStop(index);

    const destination = index === 0 ? null : selectedDestinations[index - 1];

    if (destination) {
      mapRef.current?.easeTo({
        center: destination.coordinate,
        zoom: 15,
        duration: 700,
      });
    } else if (currentLocation) {
      mapRef.current?.easeTo({
        center: currentLocation,
        zoom: 15,
        duration: 700,
      });
    }
  }

  /*
   * ------------------------------------------------------------
   * REMOVE DESTINATION
   * ------------------------------------------------------------
   */

  function removeDestination(id: number) {
    setSelectedDestinations((current) => {
      const removedIndex = current.findIndex((item) => item.id === id);

      const next = current.filter((item) => item.id !== id);

      /*
       * If the active stop was after the removed item,
       * move it one position backward.
       */
      setActiveStop((currentActive) => {
        if (next.length === 0) {
          return 0;
        }

        if (currentActive > removedIndex + 1) {
          return currentActive - 1;
        }

        return Math.min(currentActive, next.length);
      });

      return next;
    });
  }

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        styles={
          selectedStyle
            ? {
                light: selectedStyle,
                dark: selectedStyle,
              }
            : undefined
        }
        viewport={viewport}
        onViewportChange={setViewport}
      >
        <MapControls
          position="bottom-right"
          showZoom
          showCompass
          showLocate
          showFullscreen
        />

        {/* -------------------------------------------------------
            ROUTE
        ------------------------------------------------------- */}

        {route.length > 0 && (
          <MapRoute
            coordinates={route}
            progress={progress}
            color="#94a3b8"
            width={5}
            opacity={0.8}
          >
            <RouteProgress color="#3b82f6" width={5} opacity={1} />

            {/* START */}
            <RouteMarker at="start">
              <MarkerContent>
                <div className="ring-background grid size-7 place-items-center rounded-full bg-blue-600 shadow-lg ring-2">
                  <LocateFixed className="size-4 text-white" />
                </div>

                <MarkerLabel
                  position="bottom"
                  className="bg-background/90 border-border/50 mt-1 rounded-md border px-1.5 py-0.5 text-xs font-medium shadow"
                >
                  Start
                </MarkerLabel>
              </MarkerContent>
            </RouteMarker>

            {/* CURRENT POSITION */}
            <RouteMarker at="progress">
              <MarkerContent>
                <div className="ring-background grid size-7 place-items-center rounded-full bg-blue-500 shadow-md ring-2">
                  <Car className="size-4 text-white" />
                </div>

                <MarkerLabel
                  position="top"
                  className="bg-background/90 border-border/50 rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums shadow"
                >
                  Stop {activeStop} / {selectedDestinations.length}
                </MarkerLabel>
              </MarkerContent>
            </RouteMarker>
          </MapRoute>
        )}

        {/* -------------------------------------------------------
            DESTINATIONS
        ------------------------------------------------------- */}

        {selectedDestinations.map((destination, index) => {
          const stopNumber = index + 1;
          const isActive = activeStop === stopNumber;
          const isCompleted = activeStop > stopNumber;

          return (
            <MapMarker
              key={destination.id}
              longitude={destination.coordinate[0]}
              latitude={destination.coordinate[1]}
            >
              <MarkerContent>
                <div
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-xs font-bold text-white shadow-lg ring-2",
                    isActive
                      ? "bg-blue-600 ring-blue-600"
                      : isCompleted
                        ? "bg-green-600 ring-green-600"
                        : "bg-red-500 ring-white",
                  )}
                >
                  {stopNumber}
                </div>

                <MarkerLabel
                  position="bottom"
                  className={cn(
                    "bg-background/90 border-border/50 mt-1 rounded-md border px-1.5 py-0.5 text-xs font-medium shadow",
                    isActive && "border-blue-500",
                  )}
                >
                  {destination.name}
                </MarkerLabel>
              </MarkerContent>
            </MapMarker>
          );
        })}
      </Map>

      {/* -------------------------------------------------------
          ROUTE CONTROLS
      ------------------------------------------------------- */}

      <div className="bg-background/95 absolute top-3 left-3 z-10 w-80 rounded-xl border p-3 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Driver Route</p>

            <p className="text-muted-foreground text-xs">
              Choose the delivery stops
            </p>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={locateMe}
            disabled={locationLoading}
            title="Use current location"
          >
            <LocateFixed className="size-4" />
          </Button>
        </div>

        {/* START */}

        <div className="mb-3">
          <p className="text-muted-foreground mb-1.5 text-xs font-medium">
            Start
          </p>

          <button
            type="button"
            onClick={() => selectStop(0)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors",
              activeStop === 0
                ? "border-blue-500 bg-blue-500/10"
                : "bg-muted/50 hover:bg-muted",
            )}
          >
            <div className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-500">
              <LocateFixed className="size-3.5 text-white" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                My current location
              </p>

              <p className="text-muted-foreground truncate text-xs">
                {locationText}
              </p>
            </div>
          </button>
        </div>

        {/* DESTINATIONS */}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium">Stops</p>

            {selectedDestinations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  setSelectedDestinations([]);
                  setActiveStop(0);
                }}
              >
                Clear all
              </Button>
            )}
          </div>

          {/* ADD DESTINATION */}

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
              >
                <span className="truncate">Add destination</span>

                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>

            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Search destination..." />

                <CommandList>
                  <CommandEmpty>No destination found.</CommandEmpty>

                  <CommandGroup>
                    {destinations.map((destination) => {
                      const selected = selectedDestinations.some(
                        (item) => item.id === destination.id,
                      );

                      return (
                        <CommandItem
                          key={destination.id}
                          value={destination.name}
                          disabled={selected}
                          onSelect={() => {
                            setSelectedDestinations((current) => [
                              ...current,
                              destination,
                            ]);

                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              selected ? "opacity-100" : "opacity-0",
                            )}
                          />

                          <div className="min-w-0">
                            <p className="truncate text-sm">
                              {destination.name}
                            </p>

                            <p className="text-muted-foreground truncate text-xs">
                              {destination.description}
                            </p>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* ---------------------------------------------------
              STOP LIST
          --------------------------------------------------- */}

          {selectedDestinations.length > 0 && (
            <div className="mt-3">
              <div className="relative space-y-2">
                {selectedDestinations.map((destination, index) => {
                  const stopNumber = index + 1;

                  const isActive = activeStop === stopNumber;

                  const isCompleted = activeStop > stopNumber;

                  return (
                    <div
                      key={destination.id}
                      className="relative flex items-stretch gap-2"
                    >
                      {/* Connector line */}

                      {index < selectedDestinations.length - 1 && (
                        <div className="bg-border absolute top-8 bottom-[-8px] left-3 w-px" />
                      )}

                      {/* Stop button */}

                      <button
                        type="button"
                        onClick={() => selectStop(stopNumber)}
                        className={cn(
                          "relative z-10 flex min-w-0 flex-1 items-center gap-2 rounded-md border p-2 text-left transition-all",
                          isActive
                            ? "border-blue-500 bg-blue-500/10 shadow-sm"
                            : isCompleted
                              ? "border-green-500/40 bg-green-500/5"
                              : "bg-muted/30 hover:bg-muted",
                        )}
                      >
                        {/* Number */}

                        <div
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            isActive
                              ? "bg-blue-600 text-white"
                              : isCompleted
                                ? "bg-green-600 text-white"
                                : "bg-red-500 text-white",
                          )}
                        >
                          {isCompleted ? (
                            <Check className="size-3.5" />
                          ) : (
                            stopNumber
                          )}
                        </div>

                        {/* Destination */}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {destination.name}
                          </p>

                          <p className="text-muted-foreground truncate text-xs">
                            {destination.description}
                          </p>
                        </div>

                        {/* Active indicator */}

                        {isActive && (
                          <MapPin className="size-4 shrink-0 text-blue-500" />
                        )}
                      </button>

                      {/* Remove */}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 self-center"
                        onClick={() => removeDestination(destination.id)}
                        title={`Remove ${destination.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* STATUS */}

        {routeLoading && (
          <p className="text-muted-foreground mt-3 text-xs">
            Calculating route...
          </p>
        )}

        {routeError && (
          <p className="text-destructive mt-3 text-xs">{routeError}</p>
        )}
      </div>

      {/* -------------------------------------------------------
          ACTIVE STOP
      ------------------------------------------------------- */}

      {route.length > 0 && selectedDestinations.length > 0 && (
        <div className="bg-background/95 absolute bottom-4 left-1/2 w-80 -translate-x-1/2 rounded-xl border p-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full",
                activeStop === selectedDestinations.length
                  ? "bg-green-600"
                  : "bg-blue-600",
              )}
            >
              {activeStop === selectedDestinations.length ? (
                <Check className="size-5 text-white" />
              ) : (
                <Car className="size-5 text-white" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">
                {activeStop === 0
                  ? "Starting route"
                  : `Stop ${activeStop} of ${selectedDestinations.length}`}
              </p>

              <p className="truncate text-sm font-semibold">
                {activeStop === 0
                  ? "My current location"
                  : selectedDestinations[activeStop - 1]?.name}
              </p>
            </div>

            {activeStop < selectedDestinations.length && (
              <Button size="sm" onClick={() => selectStop(activeStop + 1)}>
                Next stop
              </Button>
            )}
          </div>
        </div>
      )}

      <ViewportDebug />
    </div>
  );
}
