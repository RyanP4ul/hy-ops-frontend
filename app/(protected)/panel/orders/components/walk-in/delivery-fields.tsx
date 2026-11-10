"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Map, MapControls, MapMarker, MarkerContent, useMap } from "@/components/ui/map";

export type DeliveryDetails = {
  shipping_recipient: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_latitude?: number;
  shipping_longitude?: number;
  customer_address_id?: number;
};

export type SavedDeliveryAddress = {
  id: number;
  address_line: string;
  barangay: string;
  city_municipality: string;
  province: string;
  postal_code: string | null;
  latitude: string | null;
  longitude: string | null;
};

function DestinationPin({ value, onChange }: {
  value: DeliveryDetails;
  onChange: (value: DeliveryDetails) => void;
}) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    const pick = (event: { lngLat: { lng: number; lat: number } }) => onChange({
      ...value, customer_address_id: undefined,
      shipping_latitude: event.lngLat.lat, shipping_longitude: event.lngLat.lng,
    });
    map.on("click", pick);
    return () => { map.off("click", pick); };
  }, [map, isLoaded, value, onChange]);
  useEffect(() => {
    if (map && isLoaded && value.shipping_latitude !== undefined && value.shipping_longitude !== undefined) {
      map.easeTo({ center: [value.shipping_longitude, value.shipping_latitude] });
    }
  }, [map, isLoaded, value.shipping_latitude, value.shipping_longitude]);
  return value.shipping_latitude !== undefined && value.shipping_longitude !== undefined ? (
    <MapMarker latitude={value.shipping_latitude} longitude={value.shipping_longitude}>
      <MarkerContent><span className="block size-4 rounded-full border-2 border-white bg-primary shadow" /></MarkerContent>
    </MapMarker>
  ) : null;
}

export function DeliveryFields({ value, onChange, addresses = [] }: {
  value: DeliveryDetails;
  onChange: (value: DeliveryDetails) => void;
  addresses?: SavedDeliveryAddress[];
}) {
  return <section className="space-y-3 rounded-xl border p-3.5" aria-label="Delivery details">
    <div>
      <h3 className="text-sm font-semibold">Customer delivery details</h3>
      <p className="text-xs text-muted-foreground">Ask the customer for their name, phone number, and delivery address. Confirm the destination on the map.</p>
    </div>
    {addresses.length > 0 && <label className="block space-y-1 text-xs font-medium">Saved address
      <select className="h-9 w-full rounded-md border bg-background px-2" value={value.customer_address_id ?? ""}
        onChange={event => {
          const address = addresses.find(item => item.id === Number(event.target.value));
          onChange(address ? { ...value, customer_address_id: address.id,
            shipping_address: [address.address_line, address.barangay, address.city_municipality, address.province, address.postal_code].filter(Boolean).join(", "),
            shipping_latitude: address.latitude?.trim() ? Number(address.latitude) : undefined,
            shipping_longitude: address.longitude?.trim() ? Number(address.longitude) : undefined,
          } : { ...value, customer_address_id: undefined });
        }}>
        <option value="">Enter an address for this delivery</option>
        {addresses.map(address => <option key={address.id} value={address.id}>{address.address_line}, {address.city_municipality}</option>)}
      </select>
    </label>}
    {([["shipping_recipient", "Recipient name", 60], ["shipping_phone", "Phone number", 20], ["shipping_address", "Delivery address", 1000]] as const).map(([key, label, maxLength]) => (
      <label key={key} className="block space-y-1 text-xs font-medium" htmlFor={`delivery-${key}`}>{label} *
        <Input id={`delivery-${key}`} required maxLength={maxLength} type={key === "shipping_phone" ? "tel" : "text"}
          value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value,
            ...(key === "shipping_address" ? { customer_address_id: undefined, shipping_latitude: undefined, shipping_longitude: undefined } : {}),
          })} />
      </label>
    ))}
    <div className="h-52 overflow-hidden rounded-lg border">
      <Map center={[121.02, 14.6]} zoom={11}>
        <MapControls />
        <DestinationPin value={value} onChange={onChange} />
      </Map>
    </div>
    <p className="text-xs text-muted-foreground">Click the map to set the delivery destination, or enter confirmed coordinates below.</p>
    <div className="grid grid-cols-2 gap-3">
      {([["shipping_latitude", "Latitude", -90, 90], ["shipping_longitude", "Longitude", -180, 180]] as const).map(([key, label, min, max]) => (
        <label key={key} htmlFor={`delivery-${key}`} className="space-y-1 text-xs font-medium">{label} *
          <Input id={`delivery-${key}`} type="number" step="any" min={min} max={max} required value={value[key] ?? ""}
            onChange={event => onChange({ ...value, customer_address_id: undefined, [key]: event.target.value === "" ? undefined : Number(event.target.value) })} />
        </label>
      ))}
    </div>
  </section>;
}
