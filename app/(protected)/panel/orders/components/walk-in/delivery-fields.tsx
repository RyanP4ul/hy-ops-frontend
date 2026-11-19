"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  useMap,
} from "@/components/ui/map";
import { cn } from "@/lib/utils";

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

export type DeliveryFieldErrors = Partial<
  Record<
    | "shipping_recipient"
    | "shipping_phone"
    | "shipping_address"
    | "shipping_latitude"
    | "shipping_longitude",
    string
  >
>;

function DestinationPin({
  value,
  onChange,
}: {
  value: DeliveryDetails;
  onChange: (value: DeliveryDetails) => void;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    const pick = (event: { lngLat: { lng: number; lat: number } }) =>
      onChange({
        ...value,
        customer_address_id: undefined,
        shipping_latitude: Number(event.lngLat.lat.toFixed(6)),
        shipping_longitude: Number(event.lngLat.lng.toFixed(6)),
      });
    map.on("click", pick);
    return () => {
      map.off("click", pick);
    };
  }, [map, isLoaded, value, onChange]);

  useEffect(() => {
    if (
      map &&
      isLoaded &&
      value.shipping_latitude !== undefined &&
      value.shipping_longitude !== undefined
    ) {
      map.easeTo({
        center: [value.shipping_longitude, value.shipping_latitude],
      });
    }
  }, [map, isLoaded, value.shipping_latitude, value.shipping_longitude]);

  return value.shipping_latitude !== undefined &&
    value.shipping_longitude !== undefined ? (
    <MapMarker
      latitude={value.shipping_latitude}
      longitude={value.shipping_longitude}
    >
      <MarkerContent>
        <span className="block size-4 rounded-full border-2 border-white bg-primary shadow-md" />
      </MarkerContent>
    </MapMarker>
  ) : null;
}

export function DeliveryFields({
  value,
  onChange,
  addresses = [],
  errors = {},
  submitted = false,
}: {
  value: DeliveryDetails;
  onChange: (value: DeliveryDetails) => void;
  addresses?: SavedDeliveryAddress[];
  errors?: DeliveryFieldErrors;
  submitted?: boolean;
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const hasPin =
    value.shipping_latitude !== undefined &&
    value.shipping_longitude !== undefined &&
    !(value.shipping_latitude === 0 && value.shipping_longitude === 0);

  function markTouched(field: string) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  function showError(field: keyof DeliveryFieldErrors) {
    return (submitted || touched[field]) && Boolean(errors[field]);
  }

  return (
    <fieldset className="space-y-3.5 rounded-xl border bg-card p-4">
      <legend className="px-1 text-xs font-semibold text-foreground">
        Delivery destination
      </legend>

      {addresses.length > 0 && (
        <div className="space-y-1">
          <label
            htmlFor="delivery-saved-address"
            className="block text-xs font-medium text-muted-foreground"
          >
            Saved address
          </label>
          <select
            id="delivery-saved-address"
            name="customer_address_id"
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 sm:text-sm"
            value={value.customer_address_id ?? ""}
            onChange={(event) => {
              const address = addresses.find(
                (item) => item.id === Number(event.target.value),
              );
              onChange(
                address
                  ? {
                      ...value,
                      customer_address_id: address.id,
                      shipping_address: [
                        address.address_line,
                        address.barangay,
                        address.city_municipality,
                        address.province,
                        address.postal_code,
                      ]
                        .filter(Boolean)
                        .join(", "),
                      shipping_latitude: address.latitude?.trim()
                        ? Number(address.latitude)
                        : undefined,
                      shipping_longitude: address.longitude?.trim()
                        ? Number(address.longitude)
                        : undefined,
                    }
                  : { ...value, customer_address_id: undefined },
              );
            }}
          >
            <option value="">Enter new address</option>
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.address_line}, {address.city_municipality}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="delivery-shipping_recipient"
            className="block text-xs font-medium text-foreground"
          >
            Recipient <span aria-hidden="true" className="text-destructive">*</span>
          </label>
          <Input
            id="delivery-shipping_recipient"
            name="shipping_recipient"
            type="text"
            autoComplete="shipping name"
            enterKeyHint="next"
            required
            maxLength={60}
            value={value.shipping_recipient}
            aria-invalid={showError("shipping_recipient") ? "true" : "false"}
            aria-describedby={
              showError("shipping_recipient")
                ? "delivery-shipping_recipient-error"
                : undefined
            }
            onBlur={() => markTouched("shipping_recipient")}
            onChange={(event) =>
              onChange({ ...value, shipping_recipient: event.target.value })
            }
            className={cn(
              "h-9 text-base sm:text-sm user-invalid:border-destructive",
              showError("shipping_recipient") && "border-destructive",
            )}
          />
          {showError("shipping_recipient") && (
            <p
              id="delivery-shipping_recipient-error"
              className="text-xs text-destructive"
            >
              {errors.shipping_recipient}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="delivery-shipping_phone"
            className="block text-xs font-medium text-foreground"
          >
            Phone <span aria-hidden="true" className="text-destructive">*</span>
          </label>
          <Input
            id="delivery-shipping_phone"
            name="shipping_phone"
            type="tel"
            inputMode="tel"
            autoComplete="shipping tel"
            enterKeyHint="next"
            required
            maxLength={20}
            value={value.shipping_phone}
            aria-invalid={showError("shipping_phone") ? "true" : "false"}
            aria-describedby={
              showError("shipping_phone")
                ? "delivery-shipping_phone-error"
                : undefined
            }
            onBlur={() => markTouched("shipping_phone")}
            onChange={(event) =>
              onChange({ ...value, shipping_phone: event.target.value })
            }
            placeholder="0917-000-0000"
            className={cn(
              "h-9 text-base sm:text-sm user-invalid:border-destructive",
              showError("shipping_phone") && "border-destructive",
            )}
          />
          {showError("shipping_phone") && (
            <p
              id="delivery-shipping_phone-error"
              className="text-xs text-destructive"
            >
              {errors.shipping_phone}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="delivery-shipping_address"
          className="block text-xs font-medium text-foreground"
        >
          Delivery address{" "}
          <span aria-hidden="true" className="text-destructive">*</span>
        </label>
        <Textarea
          id="delivery-shipping_address"
          name="shipping_address"
          autoComplete="shipping street-address"
          required
          rows={2}
          maxLength={1000}
          value={value.shipping_address}
          aria-invalid={showError("shipping_address") ? "true" : "false"}
          aria-describedby={
            showError("shipping_address")
              ? "delivery-shipping_address-error"
              : undefined
          }
          onBlur={() => markTouched("shipping_address")}
          onChange={(event) =>
            onChange({
              ...value,
              shipping_address: event.target.value,
              customer_address_id: undefined,
              shipping_latitude: undefined,
              shipping_longitude: undefined,
            })
          }
          placeholder="Street, barangay, city"
          className={cn(
            "min-h-[60px] text-base sm:text-sm user-invalid:border-destructive",
            showError("shipping_address") && "border-destructive",
          )}
        />
        {showError("shipping_address") && (
          <p
            id="delivery-shipping_address-error"
            className="text-xs text-destructive"
          >
            {errors.shipping_address}
          </p>
        )}
      </div>

      {/* Map pin picker */}
      <div className="space-y-2">
        <div className="relative h-48 overflow-hidden rounded-lg border">
          <Map center={[121.02, 14.6]} zoom={11}>
            <MapControls />
            <DestinationPin value={value} onChange={onChange} />
          </Map>
          <span className="pointer-events-none absolute top-2.5 left-2.5 z-10 rounded-md border bg-background/92 px-2 py-1 text-[11px] font-medium text-foreground shadow-xs backdrop-blur-sm">
            {hasPin
              ? `${value.shipping_latitude?.toFixed(5)}, ${value.shipping_longitude?.toFixed(5)}`
              : "Click map to set pin"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["shipping_latitude", "Latitude", -90, 90],
              ["shipping_longitude", "Longitude", -180, 180],
            ] as const
          ).map(([key, label, min, max]) => (
            <div key={key} className="space-y-1">
              <label
                htmlFor={`delivery-${key}`}
                className="block text-xs font-medium text-muted-foreground"
              >
                {label}{" "}
                <span aria-hidden="true" className="text-destructive">*</span>
              </label>
              <Input
                id={`delivery-${key}`}
                name={key}
                type="number"
                inputMode="decimal"
                step="any"
                min={min}
                max={max}
                required
                value={value[key] ?? ""}
                aria-invalid={showError(key) ? "true" : "false"}
                aria-describedby={
                  showError(key) ? `delivery-${key}-error` : undefined
                }
                onBlur={() => markTouched(key)}
                onChange={(event) =>
                  onChange({
                    ...value,
                    customer_address_id: undefined,
                    [key]:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value),
                  })
                }
                className={cn(
                  "h-9 text-base tabular-nums sm:text-sm user-invalid:border-destructive",
                  showError(key) && "border-destructive",
                )}
              />
            </div>
          ))}
        </div>

        {(showError("shipping_latitude") || showError("shipping_longitude")) && (
          <p
            id="delivery-shipping_latitude-error"
            className="text-xs text-destructive"
          >
            {errors.shipping_latitude || errors.shipping_longitude}
          </p>
        )}
      </div>
    </fieldset>
  );
}
