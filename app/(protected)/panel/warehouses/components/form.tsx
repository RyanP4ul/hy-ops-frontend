"use client";

import { Input } from "@/components/ui/input";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useWarehouses } from "../provider";
import { WarehouseForm } from "@/schema/warehouse";
import { useCallback, useEffect, useRef } from "react";
import { Controller } from "react-hook-form";
import { ToastSubmit, ToastValidationError } from "@/components/util";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { request, requestWithErrorHandling } from "@/components/http";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { QueryFeedback } from "@/components/query-feedback";
import { GoogleAddressSearch } from "@/components/google-address-search";
import type { GooglePlaceAddress } from "@/lib/google-place-address";

export default function Form() {
  const {
    form,
    warehouseQuery,
    warehouseDetailQuery,
    selected,
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
    } else {
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
  }, [state.isOpen, state.mode, selected.id, selected.version, warehouseDetailQuery.isFetching, warehouseDetailQuery.data, form, mapRef, setLatitude, setLongitude]);

  const selectAddress = useCallback((address: GooglePlaceAddress) => {
    for (const name of ["search_address", "street_address", "city", "state", "zip_code", "latitude", "longitude"] as const) {
      form.setValue(name, address[name], { shouldDirty: true, shouldValidate: true });
    }
    setLatitude(address.latitude);
    setLongitude(address.longitude);
    mapRef.current?.flyTo({ center: [address.longitude, address.latitude], zoom: 16 });
  }, [form, mapRef, setLatitude, setLongitude]);

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
        <Field>
          <FieldLabel htmlFor="search_address">Search Address</FieldLabel>
          <GoogleAddressSearch
            key={`${state.mode}:${selected.id}:${selected.version}`}
            onSelect={selectAddress}
            disabled={form.formState.isSubmitting || (state.mode === DialogMode.EDIT && warehouseDetailQuery.isFetching)}
          />
        </Field>
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
