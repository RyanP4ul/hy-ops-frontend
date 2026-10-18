"use client";

import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
} from "@/components/ui/map";

import { Warehouse, Truck, MapPin } from "lucide-react";

// Coordinates use [longitude, latitude] for mapcn routes.
const warehouse = {
  lng: 120.8833,
  lat: 14.8333,
  name: "HY Company Warehouse",
  address: "Guiguinto, Bulacan",
};

const deliveries = [
  {
    id: "RUN-0001",
    customer: "ABC Trading",
    address: "Guiguinto, Bulacan",
    status: "IN_TRANSIT",
    lng: 120.895,
    lat: 14.823,
  },
  {
    id: "RUN-0002",
    customer: "Bulacan Hardware",
    address: "Malolos, Bulacan",
    status: "IN_TRANSIT",
    lng: 120.8114,
    lat: 14.8433,
  },
  {
    id: "RUN-0003",
    customer: "Prime Industrial",
    address: "Balagtas, Bulacan",
    status: "SCHEDULED",
    lng: 120.8667,
    lat: 14.8167,
  },
  {
    id: "RUN-0004",
    customer: "Customer Stop",
    address: "Meycauayan, Bulacan",
    status: "IN_TRANSIT",
    lng: 120.9608,
    lat: 14.7369,
  },
];

// Illustrative route paths, not road-following navigation data.
const routeOne: [number, number][] = [
  [warehouse.lng, warehouse.lat],
  [120.87, 14.84],
  [120.84, 14.85],
  [120.8114, 14.8433],
];

const routeTwo: [number, number][] = [
  [warehouse.lng, warehouse.lat],
  [120.9, 14.8],
  [120.93, 14.77],
  [120.9608, 14.7369],
];

export default function DeliveryMapInner() {
  return (
    <Map
      center={[120.87, 14.80]}
      zoom={10}
      className="h-full w-full"
    >
      <MapControls
        position="top-right"
        showZoom
        showCompass
        showFullscreen
      />

      {/* Warehouse marker */}
      <MapMarker
        longitude={warehouse.lng}
        latitude={warehouse.lat}
      >
        <MarkerContent>
          <div className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-gray-900 text-white shadow-lg dark:bg-white dark:text-gray-900">
            <Warehouse className="size-4" />
          </div>
        </MarkerContent>

        <MarkerTooltip>
          {warehouse.name}
        </MarkerTooltip>

        <MarkerPopup>
          <div className="space-y-1">
            <p className="font-semibold">
              {warehouse.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {warehouse.address}
            </p>
          </div>
        </MarkerPopup>
      </MapMarker>

      {/* Sample delivery routes */}
      <MapRoute
        coordinates={routeOne}
        color="#2563eb"
        width={4}
        opacity={0.85}
      />

      <MapRoute
        coordinates={routeTwo}
        color="#0d9488"
        width={4}
        opacity={0.85}
      />

      {/* Delivery run markers */}
      {deliveries.map((delivery, index) => {
        const isScheduled = delivery.status === "SCHEDULED";

        return (
          <MapMarker
            key={delivery.id}
            longitude={delivery.lng}
            latitude={delivery.lat}
          >
            <MarkerContent>
              <div
                className={[
                  "flex size-8 items-center justify-center rounded-full",
                  "border-2 border-white text-white shadow-lg",
                  isScheduled ? "bg-amber-500" : "bg-blue-600",
                ].join(" ")}
              >
                {isScheduled ? (
                  <MapPin className="size-4" />
                ) : (
                  <Truck className="size-4" />
                )}
              </div>
            </MarkerContent>

            <MarkerTooltip>
              {delivery.id}
            </MarkerTooltip>

            <MarkerPopup>
              <div className="min-w-44 space-y-2">
                <p className="font-semibold">
                  {delivery.id}
                </p>

                <p className="text-sm">
                  {delivery.customer}
                </p>

                <p className="text-xs text-muted-foreground">
                  {delivery.address}
                </p>

                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={[
                      "size-2 rounded-full",
                      isScheduled ? "bg-amber-500" : "bg-blue-600",
                    ].join(" ")}
                  />

                  {delivery.status.replace(/_/g, " ")}
                </div>

                <p className="text-xs text-muted-foreground">
                  Stop {index + 1}
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        );
      })}
    </Map>
  );
}
