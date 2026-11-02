"use client";

import { useState } from "react";
import { ArrowDownUp, Loader2, MapPin, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PointInput = {
  lat: string;
  lng: string;
};

type LocationInput = PointInput & {
  id: string;
  name: string;
};

type SortedLocation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  sortOrder: number;
  distanceKm: number;
  distanceMeters: number;
};

type SortResponse = {
  origin: { lat: number; lng: number };
  count: number;
  sortedBy: string;
  distanceType: "straight_line";
  locations: SortedLocation[];
};

function makeLocation(): LocationInput {
  return {
    id: crypto.randomUUID(),
    name: "",
    lat: "",
    lng: "",
  };
}

function parseCoordinate(
  value: string,
  min: number,
  max: number,
): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong while sorting coordinates.";
}

export default function CoordinateSorter() {
  const [origin, setOrigin] = useState<PointInput>({ lat: "", lng: "" });
  const [locations, setLocations] = useState<LocationInput[]>([
    { id: "location-1", name: "", lat: "", lng: "" },
    { id: "location-2", name: "", lat: "", lng: "" },
  ]);
  const [result, setResult] = useState<SortResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSorting, setIsSorting] = useState(false);

  function updateOrigin(field: keyof PointInput, value: string) {
    setOrigin((current) => ({ ...current, [field]: value }));
    setResult(null);
    setError(null);
  }

  function updateLocation(
    id: string,
    field: keyof Omit<LocationInput, "id">,
    value: string,
  ) {
    setLocations((current) =>
      current.map((location) =>
        location.id === id ? { ...location, [field]: value } : location,
      ),
    );
    setResult(null);
    setError(null);
  }

  function addLocation() {
    setLocations((current) => [...current, makeLocation()]);
    setResult(null);
    setError(null);
  }

  function removeLocation(id: string) {
    setLocations((current) => current.filter((location) => location.id !== id));
    setResult(null);
    setError(null);
  }

  async function sortLocations() {
    setError(null);
    setResult(null);

    const originLat = parseCoordinate(origin.lat, -90, 90);
    const originLng = parseCoordinate(origin.lng, -180, 180);

    if (originLat === null || originLng === null) {
      setError(
        "Enter a valid origin latitude (-90 to 90) and longitude (-180 to 180).",
      );
      return;
    }

    const preparedLocations: Array<{
      id: string;
      name: string;
      lat: number;
      lng: number;
    }> = [];

    for (let index = 0; index < locations.length; index += 1) {
      const location = locations[index];
      const name = location.name.trim();
      const lat = parseCoordinate(location.lat, -90, 90);
      const lng = parseCoordinate(location.lng, -180, 180);

      if (!name || lat === null || lng === null) {
        setError(
          `Complete the name, latitude, and longitude for location ${index + 1}, or remove that row.`,
        );
        return;
      }

      preparedLocations.push({ id: location.id, name, lat, lng });
    }

    setIsSorting(true);

    try {
      const response = await fetch(`/api/fleet-map/coordinates/sort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: originLat, lng: originLng },
          locations: preparedLocations,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const apiMessage =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload
            ? (payload as { message?: unknown }).message
            : null;
        throw new Error(
          typeof apiMessage === "string"
            ? apiMessage
            : `The API request failed (HTTP ${response.status}). Check the Elysia server and API URL.`,
        );
      }

      setResult(payload as SortResponse);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsSorting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Coordinate Distance Sorter
          </h1>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Compare multiple order or delivery coordinates from one starting
          point, then sort them from nearest to farthest.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Starting point</CardTitle>
          <CardDescription>
            Enter the warehouse, truck, or other reference point. Use decimal
            degrees.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="origin-lat">Latitude</Label>
            <Input
              id="origin-lat"
              inputMode="decimal"
              placeholder="e.g. 14.832451"
              value={origin.lat}
              onChange={(event) => updateOrigin("lat", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Valid range: -90 to 90
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="origin-lng">Longitude</Label>
            <Input
              id="origin-lng"
              inputMode="decimal"
              placeholder="e.g. 120.882177"
              value={origin.lng}
              onChange={(event) => updateOrigin("lng", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Valid range: -180 to 180
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Locations to compare</CardTitle>
            <CardDescription>
              Add one row for each customer, order, warehouse, or delivery stop.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={addLocation}>
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Add location
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {locations.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No locations added yet. Select “Add location” to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {locations.map((location, index) => (
                <div
                  key={location.id}
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`${location.id}-name`}>
                      Location {index + 1} name
                    </Label>
                    <Input
                      id={`${location.id}-name`}
                      placeholder="e.g. Customer / Order #"
                      value={location.name}
                      onChange={(event) =>
                        updateLocation(location.id, "name", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${location.id}-lat`}>Latitude</Label>
                    <Input
                      id={`${location.id}-lat`}
                      inputMode="decimal"
                      placeholder="14.832451"
                      value={location.lat}
                      onChange={(event) =>
                        updateLocation(location.id, "lat", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${location.id}-lng`}>Longitude</Label>
                    <Input
                      id={`${location.id}-lng`}
                      inputMode="decimal"
                      placeholder="120.882177"
                      value={location.lng}
                      onChange={(event) =>
                        updateLocation(location.id, "lng", event.target.value)
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove location ${index + 1}`}
                    title="Remove location"
                    onClick={() => removeLocation(location.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Maximum 500 locations per request. Distances are straight-line
              estimates.
            </p>
            <Button type="button" onClick={sortLocations} disabled={isSorting}>
              {isSorting ? (
                <Loader2
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowDownUp className="mr-2 size-4" aria-hidden="true" />
              )}
              {isSorting ? "Sorting…" : "Sort nearest to farthest"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Sorted results</CardTitle>
                <CardDescription>
                  Rank 1 is the closest coordinate to your starting point.
                </CardDescription>
              </div>
              <Badge variant="secondary">
                {result.count} {result.count === 1 ? "location" : "locations"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {result.locations.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                There are no locations to display. Add at least one location and
                sort again.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Latitude</TableHead>
                      <TableHead>Longitude</TableHead>
                      <TableHead className="text-right">Distance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.locations.map((location) => (
                      <TableRow key={location.id}>
                        <TableCell className="font-medium">
                          #{location.sortOrder}
                        </TableCell>
                        <TableCell>{location.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {location.lat.toFixed(6)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {location.lng.toFixed(6)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className="font-medium">
                            {location.distanceKm.toFixed(2)} km
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {location.distanceMeters.toLocaleString()} m
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              This ranking measures each location separately from the origin. It
              does not calculate the best multi-stop driving route.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
