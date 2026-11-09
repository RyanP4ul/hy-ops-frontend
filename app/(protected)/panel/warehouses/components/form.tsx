"use client";

import { Input } from "@/components/ui/input";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useWarehouses } from "../provider";
import { WarehouseForm, warehouseSchema } from "@/schema/warehouse";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { ToastSubmit, ToastValidationError } from "@/components/util";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { request, requestWithErrorHandling } from "@/components/http";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { Map, MapMarker, MapRef, MarkerContent } from "@/components/ui/map";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { GeocodeResult } from "@/types/geocode";
import { useQuery } from "@tanstack/react-query";
import { QueryFeedback } from "@/components/query-feedback";
import { debounce } from "@/utils/debounce";

export default function Form() {
  const {
    form,
    warehouseQuery,
    warehouseDetailQuery,
    selected,
    setSearchAddress,
    geocodeQuery,
    mapRef,
    setLatitude,
    setLongitude,
  } = useWarehouses();
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const initialized = useRef<string | null>(null);

  useEffect(() => {
    if (!state.isOpen) { initialized.current = null; return; }
    const key = `${state.mode}:${selected.id}:${selected.version}`;
    if (initialized.current === key) return;
    if (state.mode === DialogMode.EDIT && (warehouseDetailQuery.isFetching || !warehouseDetailQuery.data)) return;
    initialized.current = key;
    if (state.mode === DialogMode.EDIT && warehouseDetailQuery.data) {
      if (warehouseDetailQuery.data.latitude != null && warehouseDetailQuery.data.longitude != null) {
        setLatitude(Number(warehouseDetailQuery.data.latitude)); setLongitude(Number(warehouseDetailQuery.data.longitude));
        mapRef.current?.flyTo({ center: [Number(warehouseDetailQuery.data.longitude), Number(warehouseDetailQuery.data.latitude)], zoom: 16 });
      }
      form.reset({
        latitude: warehouseDetailQuery.data?.latitude == null ? null : Number(warehouseDetailQuery.data.latitude),
        longitude: warehouseDetailQuery.data?.longitude == null ? null : Number(warehouseDetailQuery.data.longitude),
        name: warehouseDetailQuery.data?.name ?? "",
        phone_number: warehouseDetailQuery.data?.phone_number ?? "",
        street_address: warehouseDetailQuery.data?.street_address ?? "",
        city: warehouseDetailQuery.data?.city ?? "",
        state: warehouseDetailQuery.data?.state ?? "",
        zip_code: warehouseDetailQuery.data?.zip_code ?? "",
      });

      setSearchAddress("");
    } else {
      setSearchAddress("");
      form.reset({
        latitude: null,
        longitude: null,
        name: "",
        phone_number: "",
        street_address: "",
        city: "",
        state: "",
        zip_code: "",
      });
    }
  }, [state.isOpen, state.mode, selected.id, selected.version, warehouseDetailQuery.isFetching, warehouseDetailQuery.data, form, mapRef, setLatitude, setLongitude, setSearchAddress]);

  const debouncedSearch = useMemo(
    () => debounce(setSearchAddress, 500),
    [setSearchAddress],
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const onSuccess = () => {
    warehouseQuery.refetch();

    if (selected.id > 0) {
      warehouseDetailQuery.refetch();
    }

    dispatch({
      type: "CLOSE",
    });
  };

  async function onSubmit(data: WarehouseForm) {
    ToastSubmit(data);
    const payload = { ...data, latitude: data.latitude ?? undefined, longitude: data.longitude ?? undefined };

    if (state.mode === DialogMode.EDIT && selected.id > 0) {
      const response = await request("PUT", `/api/warehouses/${selected.id}`, {
        ...payload,
        version: selected.version,
        clear_coordinates: data.latitude == null && data.longitude == null,
      });
      await requestWithErrorHandling(response, form, (result) => {
        onSuccess();
        send({
          type: REQUESTS.WAREHOUSE_UPDATED,
          payload: [JSON.stringify(result.data)],
        });
      });
    } else {
      const response = await request("POST", `/api/warehouses`, payload);

      await requestWithErrorHandling(response, form, (result) => {
        onSuccess();
        send({
          type: REQUESTS.WAREHOUSE_ADDED,
          payload: [
            JSON.stringify({
              id: result?.id ?? 0,
              ...data,
            }),
          ],
        });
      });
    }
  }

  return (
    <>
      <form
        id="form"
        onSubmit={form.handleSubmit(onSubmit, (error) =>
          ToastValidationError(error),
        )}
        className="space-y-4"
      >
        {state.mode === DialogMode.EDIT && <QueryFeedback query={warehouseDetailQuery} label="warehouse details" />}
        {geocodeQuery.isError && <QueryFeedback query={geocodeQuery} label="address search" />}
        <div className="gap-4">
          <Controller
            name="search_address"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="search_address">Search Address</FieldLabel>
                <Combobox
                  {...field}
                  items={geocodeQuery.data ?? []}
                  aria-invalid={fieldState.invalid}
                  onValueChange={(value) => {
                    const selectedAddress = geocodeQuery.data?.find(
                      (item) => item.place_id === Number(value),
                    );

                    if (!selectedAddress) return;

                    // form.setValue(
                    //   "search_address",
                    //   selectedAddress.display_name,
                    // );

                    // field.onChange(selectedAddress.display_name);

                    const street = [
                      selectedAddress.address.house_number,
                      selectedAddress.address.road,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    form.setValue("street_address", street || "");

                    form.setValue("city", selectedAddress.address.city || selectedAddress.address.town || selectedAddress.address.municipality || "");

                    form.setValue("state", selectedAddress.address.state || "");

                    form.setValue(
                      "zip_code",
                      selectedAddress.address.postcode || "",
                    );

                    const newLatitude = Number(selectedAddress.lat);
                    const newLongitude = Number(selectedAddress.lon);

                    form.setValue("latitude", newLatitude, { shouldDirty: true });
                    form.setValue("longitude", newLongitude, { shouldDirty: true });
                    setLatitude(newLatitude);
                    setLongitude(newLongitude);

                    mapRef.current?.flyTo({
                      center: [newLongitude, newLatitude],
                      zoom: 16,
                      duration: 1000,
                    });
                  }}
                >
                  <ComboboxInput
                    id="search_address"
                    placeholder="Search Warehouse Address"
                    onChange={(e) => {
                      const value = e.target.value;
                      debouncedSearch(value);
                    }}
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No address found.</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem
                          key={item.place_id}
                          value={item.place_id.toString()}
                        >
                          {item.display_name}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>

                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
        <p className="text-sm text-muted-foreground" role={geocodeQuery.isError ? "status" : undefined}>
          {geocodeQuery.isError ? "Address search is unavailable. " : ""}You can enter the address below without using search. Coordinates are optional; use a verified map location.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(["latitude", "longitude"] as const).map((coordinate) => (
            <Controller key={coordinate} name={coordinate} control={form.control} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={coordinate}>{coordinate === "latitude" ? "Latitude" : "Longitude"} (optional)</FieldLabel>
                <Input id={coordinate} type="number" step="any" min={coordinate === "latitude" ? -90 : -180} max={coordinate === "latitude" ? 90 : 180}
                  value={field.value ?? ""} onBlur={field.onBlur} name={field.name} ref={field.ref} aria-invalid={fieldState.invalid}
                  onChange={(event) => {
                    const value = event.target.value === "" ? null : event.target.valueAsNumber;
                    field.onChange(value);
                    if (value !== null && Number.isFinite(value)) {
                      if (coordinate === "latitude") setLatitude(value); else setLongitude(value);
                    }
                  }} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )} />
          ))}
        </div>
        <Controller
          name="name"
          control={form.control}
          disabled={
            (state.mode === DialogMode.EDIT &&
              warehouseDetailQuery.isFetching) ||
            warehouseDetailQuery.isFetching
          }
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="name">
                Warehouse Name<span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="name"
                type="text"
                aria-invalid={fieldState.invalid}
                placeholder="Enter Name"
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="phone_number"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="warehouse_phone_number">Warehouse phone number</FieldLabel>
              <Input {...field} value={field.value ?? ""} id="warehouse_phone_number" type="tel" maxLength={20} autoComplete="tel" placeholder="+639XXXXXXXXX" aria-invalid={fieldState.invalid} />
              <p className="text-xs text-muted-foreground">Used by Lalamove to contact this warehouse at pickup. Required for courier bookings.</p>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="street_address"
          control={form.control}
          disabled={
            (state.mode === DialogMode.EDIT &&
              warehouseDetailQuery.isFetching) ||
            warehouseDetailQuery.isFetching
          }
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="street_address">
                Street Address
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="street_address"
                type="text"
                aria-invalid={fieldState.invalid}
                placeholder="Enter Street Address"
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Controller
            name="city"
            control={form.control}
            disabled={
              (state.mode === DialogMode.EDIT &&
                warehouseDetailQuery.isFetching) ||
              warehouseDetailQuery.isFetching
            }
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="city">
                  City<span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  {...field}
                  id="city"
                  type="text"
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter City"
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="state"
            control={form.control}
            disabled={
              (state.mode === DialogMode.EDIT &&
                warehouseDetailQuery.isFetching) ||
              warehouseDetailQuery.isFetching
            }
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="state">
                  Province<span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  {...field}
                  id="state"
                  type="text"
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter Province"
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="zip_code"
            control={form.control}
            disabled={
              (state.mode === DialogMode.EDIT &&
                warehouseDetailQuery.isFetching) ||
              warehouseDetailQuery.isFetching
            }
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="zip_code">
                  Zip Code<span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  {...field}
                  id="zip_code"
                  type="text"
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter Zip Code"
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
      </form>
    </>
  );
}
