"use client";

import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Map, MapMarker, MarkerContent, MapRef } from "@/components/ui/map";
import { AddressCombobox, type AddressResult } from "./address-combo";
import { warehouseSchema, type WarehouseForm } from "./schema";

export default function Page() {
  const form = useForm<WarehouseForm>({
    resolver: zodResolver(warehouseSchema),

    defaultValues: {
      name: "",
      street_address: "",
      city: "",
      state: "",
      zip_code: "",
      latitude: undefined,
      longitude: undefined,
    },
  });

  const mapRef = useRef<MapRef>(null);

  const latitude = useWatch({
    control: form.control,
    name: "latitude",
  });

  const longitude = useWatch({
    control: form.control,
    name: "longitude",
  });

  const handleAddressSelect = (result: AddressResult) => {
    const address = result.address;

    const street = [address.house_number, address.road]
      .filter(Boolean)
      .join(" ");

    const city =
      address.city ??
      address.town ??
      address.municipality ??
      address.village ??
      "";

    const state = address.province ?? address.state ?? "";

    const zipCode = address.postcode ?? "";

    const newLatitude = Number(result.lat);
    const newLongitude = Number(result.lon);

    form.setValue("street_address", street, {
      shouldValidate: true,
      shouldDirty: true,
    });

    form.setValue("city", city, {
      shouldValidate: true,
      shouldDirty: true,
    });

    form.setValue("state", state, {
      shouldValidate: true,
      shouldDirty: true,
    });

    form.setValue("zip_code", zipCode, {
      shouldValidate: true,
      shouldDirty: true,
    });

    form.setValue("latitude", newLatitude, {
      shouldValidate: true,
      shouldDirty: true,
    });

    form.setValue("longitude", newLongitude, {
      shouldValidate: true,
      shouldDirty: true,
    });

    // Move the existing map to the new address
    mapRef.current?.flyTo({
      center: [newLongitude, newLatitude],
      zoom: 17,
      duration: 1000,
    });
  };

  // Also watch for coordinate changes.
  // This handles cases where latitude/longitude are changed
  // somewhere other than handleAddressSelect.
  useEffect(() => {
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      return;
    }

    mapRef.current?.flyTo({
      center: [longitude, latitude],
      zoom: 17,
      duration: 1000,
    });
  }, [latitude, longitude]);

  const onSubmit = (data: WarehouseForm) => {
    console.log(data);
  };

  const hasLocation =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude);

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mx-auto max-w-5xl space-y-6 p-6"
    >
      {/* Warehouse name */}

      <div className="space-y-2">
        <label className="text-sm font-medium">Warehouse Name</label>

        <input
          {...form.register("name")}
          className="w-full rounded-md border px-3 py-2"
          placeholder="Main Warehouse"
        />
      </div>

      {/* Address search */}

      <div className="space-y-2">
        <label className="text-sm font-medium">Search Address</label>

        <AddressCombobox
          value={form.watch("street_address")}
          onSelect={handleAddressSelect}
        />
      </div>

      {/* Address + Map */}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Address fields */}

        <div className="space-y-4">
          {/* Street */}

          <div className="space-y-2">
            <label className="text-sm font-medium">Street Address</label>

            <input
              {...form.register("street_address")}
              className="w-full rounded-md border px-3 py-2"
              placeholder="Street address"
            />
          </div>

          {/* City */}

          <div className="space-y-2">
            <label className="text-sm font-medium">City</label>

            <input
              {...form.register("city")}
              className="w-full rounded-md border px-3 py-2"
              placeholder="City"
            />
          </div>

          {/* Province */}

          <div className="space-y-2">
            <label className="text-sm font-medium">Province</label>

            <input
              {...form.register("state")}
              className="w-full rounded-md border px-3 py-2"
              placeholder="Province"
            />
          </div>

          {/* ZIP */}

          <div className="space-y-2">
            <label className="text-sm font-medium">ZIP Code</label>

            <input
              {...form.register("zip_code")}
              className="w-full rounded-md border px-3 py-2"
              placeholder="ZIP code"
            />
          </div>

          {/* Coordinates */}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Latitude</label>

              <input
                {...form.register("latitude", {
                  valueAsNumber: true,
                })}
                readOnly
                className="w-full rounded-md border bg-muted px-3 py-2"
                placeholder="Latitude"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Longitude</label>

              <input
                {...form.register("longitude", {
                  valueAsNumber: true,
                })}
                readOnly
                className="w-full rounded-md border bg-muted px-3 py-2"
                placeholder="Longitude"
              />
            </div>
          </div>
        </div>

        {/* Map */}

        <div className="overflow-hidden rounded-lg border">
          <div className="h-[400px] w-full">
            {hasLocation ? (
              <Map ref={mapRef} center={[longitude, latitude]} zoom={17}>
                <MapMarker longitude={longitude} latitude={latitude}>
                  <MarkerContent>
                    <div className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-primary shadow-lg">
                      <div className="size-3 rounded-full bg-white" />
                    </div>
                  </MarkerContent>
                </MapMarker>
              </Map>
            ) : (
              <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                Search and select an address to display it on the map
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submit */}

      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        Save Warehouse
      </button>
    </form>
  );
}
