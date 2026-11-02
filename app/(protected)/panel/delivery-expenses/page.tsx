"use client";

import { formatCurrency as peso } from "@/utils/date-util";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RoutePoint = {
  id: number;
  label: string;
  latitude: string;
  longitude: string;
};

type TollDetection = {
  status: "DETECTED" | "NO_TOLL_TAG_FOUND" | "UNAVAILABLE";
  hasToll: boolean | null;
  source: string;
  note: string;
  roads: {
    osmWayId: number;
    name: string | null;
    ref: string | null;
    tollTag: string;
    matchedRouteEdges: number;
  }[];
  tollPoints: {
    osmNodeId: number;
    type: "TOLL_BOOTH" | "TOLL_GANTRY";
    name: string | null;
    ref: string | null;
  }[];
  matchedRoadNames: {
    expressway: string;
    name: string | null;
    ref: string | null;
    matchedStepCount: number;
    distanceKm: number;
  }[];
};

type EstimateResponse = {
  route: {
    distanceKm: number;
    durationMinutes: number;
    inputPointCount: number;
    routeWaypointCount: number;
    legCount: number;
    isRoundTrip: boolean;
    geometry: { type: "LineString"; coordinates: [number, number][] };
    waypoints: {
      name: string | null;
      location: [number, number];
      distanceFromRoadMeters: number;
    }[];
  };
  tollDetection: TollDetection;
  expenses: {
    driverAllowance: number;
    estimatedFuelLiters: number;
    estimatedFuelCost: number;
    hasToll: boolean | null;
    estimatedTollFee: number | null;
    estimatedTotal: number | null;
    estimatedTotalExcludingUnknownToll: number;
    tollFeeStatus: string;
  };
};

const MAX_POINTS = 30;


const initialPoints: RoutePoint[] = [
  { id: 1, label: "Warehouse", latitude: "14.815", longitude: "120.906" },
  { id: 2, label: "Order 1 delivery", latitude: "14.85", longitude: "120.98" },
];

export default function Page() {
  const [points, setPoints] = useState<RoutePoint[]>(initialPoints);
  const [nextId, setNextId] = useState(3);
  const [isRoundTrip, setIsRoundTrip] = useState(true);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePoint(
    id: number,
    field: "label" | "latitude" | "longitude",
    value: string,
  ) {
    setPoints((current) =>
      current.map((point) =>
        point.id === id ? { ...point, [field]: value } : point,
      ),
    );
  }

  function addDeliveryStop() {
    if (points.length >= MAX_POINTS) return;
    const orderNumber = points.length;
    setPoints((current) => [
      ...current,
      {
        id: nextId,
        label: `Order ${orderNumber} delivery`,
        latitude: "",
        longitude: "",
      },
    ]);
    setNextId((current) => current + 1);
  }

  function removeDeliveryStop(id: number) {
    if (id === points[0]?.id) return; // Keep the warehouse/start point.
    setPoints((current) => current.filter((point) => point.id !== id));
  }

  function moveDeliveryStop(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (index <= 0 || targetIndex <= 0 || targetIndex >= points.length) return;
    setPoints((current) => {
      const copy = [...current];
      [copy[index], copy[targetIndex]] = [copy[targetIndex]!, copy[index]!];
      return copy;
    });
  }

  async function calculateEstimate() {
    setLoading(true);
    setError(null);
    setEstimate(null);

    try {
      if (points.length < 2) {
        throw new Error("Add at least one delivery stop after the warehouse.");
      }
      if (points.length > MAX_POINTS) {
        throw new Error(
          `You can use up to ${MAX_POINTS} route points, including the warehouse.`,
        );
      }

      const emptyPoint = points.find(
        (point) => !point.latitude.trim() || !point.longitude.trim(),
      );
      if (emptyPoint) {
        throw new Error(
          `Enter both latitude and longitude for ${emptyPoint.label}.`,
        );
      }

      const coordinates = points.map((point) => ({
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
      }));

      const invalidIndex = coordinates.findIndex(
        (point) =>
          !Number.isFinite(point.latitude) ||
          point.latitude < -90 ||
          point.latitude > 90 ||
          !Number.isFinite(point.longitude) ||
          point.longitude < -180 ||
          point.longitude > 180,
      );
      if (invalidIndex !== -1) {
        throw new Error(
          `Invalid latitude or longitude for ${points[invalidIndex]?.label ?? `point ${invalidIndex + 1}`}.`,
        );
      }

      const response = await fetch("/api/delivery-estimates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: coordinates, isRoundTrip }),
      });

      const raw = await response.text();
      let data: unknown = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        /* server may return text or HTML */
      }
      if (!response.ok) {
        const message =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof data.message === "string"
            ? data.message
            : raw || `Request failed (HTTP ${response.status})`;
        throw new Error(message);
      }
      setEstimate(data as EstimateResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Delivery Expense Estimator</h1>
        <p className="text-sm text-muted-foreground">
          Add the warehouse and every order destination. OSRM calculates one
          route through the points in the order shown below.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Route points</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {points.length} of {MAX_POINTS} points · First point is the
              warehouse.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addDeliveryStop}
            disabled={points.length >= MAX_POINTS}
          >
            Add delivery stop
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {points.map((point, index) => (
            <div key={point.id} className="rounded-lg border p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {index === 0
                    ? "🏭 Warehouse / Start"
                    : `Stop ${index} · Delivery`}
                </p>
                <div className="flex items-center gap-1">
                  {index > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Move ${point.label} up`}
                      onClick={() => moveDeliveryStop(index, -1)}
                    >
                      ↑ Up
                    </Button>
                  )}
                  {index > 0 && index < points.length - 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Move ${point.label} down`}
                      onClick={() => moveDeliveryStop(index, 1)}
                    >
                      ↓ Down
                    </Button>
                  )}
                  {index > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeDeliveryStop(point.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              <label
                className="mb-1 block text-sm text-muted-foreground"
                htmlFor={`label-${point.id}`}
              >
                Stop label
              </label>
              <input
                id={`label-${point.id}`}
                value={point.label}
                onChange={(event) =>
                  updatePoint(point.id, "label", event.target.value)
                }
                className="mb-3 h-9 w-full rounded-md border bg-background px-3 text-sm"
                placeholder={
                  index === 0 ? "Warehouse" : "Order / customer name"
                }
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    className="mb-1 block text-sm"
                    htmlFor={`lat-${point.id}`}
                  >
                    Latitude
                  </label>
                  <input
                    id={`lat-${point.id}`}
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={point.latitude}
                    onChange={(event) =>
                      updatePoint(point.id, "latitude", event.target.value)
                    }
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    placeholder="e.g. 14.815"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-sm"
                    htmlFor={`lng-${point.id}`}
                  >
                    Longitude
                  </label>
                  <input
                    id={`lng-${point.id}`}
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={point.longitude}
                    onChange={(event) =>
                      updatePoint(point.id, "longitude", event.target.value)
                    }
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    placeholder="e.g. 120.906"
                  />
                </div>
              </div>
            </div>
          ))}

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={isRoundTrip}
              onChange={(event) => setIsRoundTrip(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">
                Return to warehouse after the last delivery
              </span>
              <span className="block text-muted-foreground">
                When enabled, the backend adds the starting coordinate to the
                end of the route.
              </span>
            </span>
          </label>

          <Button
            onClick={calculateEstimate}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Calculating route..." : "Calculate Expenses"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {estimate && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Route Distance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {estimate.route.distanceKm.toFixed(2)} km
                </p>
                <p className="text-sm text-muted-foreground">
                  {estimate.route.legCount} route legs
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Estimated Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {estimate.route.durationMinutes} min
                </p>
                <p className="text-sm text-muted-foreground">
                  OSRM route estimate
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Driver Allowance</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {peso(estimate.expenses.driverAllowance)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Estimated Fuel</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {peso(estimate.expenses.estimatedFuelCost)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {estimate.expenses.estimatedFuelLiters.toFixed(2)} L
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Toll Road Detection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-medium">
                {estimate.tollDetection.status === "DETECTED"
                  ? "Toll road likely detected"
                  : estimate.tollDetection.status === "UNAVAILABLE"
                    ? "Detection unavailable"
                    : "No toll tags matched"}
              </p>
              <p className="text-sm text-muted-foreground">
                Source: {estimate.tollDetection.source}
              </p>
              <p className="text-sm text-muted-foreground">
                {estimate.tollDetection.note}
              </p>
              {estimate.tollDetection.matchedRoadNames.map((road, index) => (
                <div
                  key={`${road.expressway}-${index}`}
                  className="rounded-md border p-3 text-sm"
                >
                  <p className="font-medium">{road.expressway}</p>
                  <p className="text-muted-foreground">
                    OSRM name: {road.name ?? "Not provided"} · Ref:{" "}
                    {road.ref ?? "Not provided"}
                  </p>
                  <p className="text-muted-foreground">
                    Matched steps: {road.matchedStepCount} · Distance:{" "}
                    {road.distanceKm.toFixed(2)} km
                  </p>
                </div>
              ))}
              {estimate.tollDetection.roads.map((road) => (
                <div
                  key={road.osmWayId}
                  className="rounded-md border p-3 text-sm"
                >
                  <p className="font-medium">
                    {road.name ?? road.ref ?? `OSM way ${road.osmWayId}`}
                  </p>
                  <p className="text-muted-foreground">
                    {road.tollTag} · matched route edges:{" "}
                    {road.matchedRouteEdges}
                  </p>
                </div>
              ))}
              {estimate.tollDetection.tollPoints.map((point) => (
                <div
                  key={point.osmNodeId}
                  className="rounded-md border p-3 text-sm"
                >
                  {point.name ?? point.ref ?? `OSM node ${point.osmNodeId}`} —{" "}
                  {point.type}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estimated Toll</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {estimate.expenses.estimatedTollFee === null
                  ? "Unknown — fee lookup needed"
                  : peso(estimate.expenses.estimatedTollFee)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Estimated Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {estimate.expenses.estimatedTotal === null ? (
                <>
                  <p className="text-2xl font-semibold">
                    {peso(estimate.expenses.estimatedTotalExcludingUnknownToll)}{" "}
                    + toll
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Subtotal excludes the unknown toll fee.
                  </p>
                </>
              ) : (
                <p className="text-2xl font-semibold">
                  {peso(estimate.expenses.estimatedTotal)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
