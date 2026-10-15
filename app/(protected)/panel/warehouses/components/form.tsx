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

  useEffect(() => {
    if (state.mode === DialogMode.EDIT && warehouseDetailQuery.data) {
      form.reset({
        name: warehouseDetailQuery.data?.name ?? "",
        street_address: warehouseDetailQuery.data?.street_address ?? "",
        city: warehouseDetailQuery.data?.city ?? "",
        state: warehouseDetailQuery.data?.state ?? "",
        zip_code: warehouseDetailQuery.data?.zip_code ?? "",
      });

      setSearchAddress(
        `${warehouseDetailQuery.data?.city}, ${warehouseDetailQuery.data?.state}, ${warehouseDetailQuery.data?.zip_code}`,
      );
    } else {
      form.reset({
        name: "",
        street_address: "",
        city: "",
        state: "",
        zip_code: "",
      });
    }
  }, [state, warehouseDetailQuery.isFetched]);

  const debouncedSearch = useMemo(
    () => debounce(setSearchAddress, 500),
    [setSearchAddress],
  );

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

    if (state.mode === DialogMode.EDIT && selected.id > 0) {
      const response = await request("PUT", `/api/warehouses/${selected.id}`, {
        ...data,
        version: selected.version,
      });
      requestWithErrorHandling(response, form, (result) => {
        onSuccess();
        send({
          type: REQUESTS.WAREHOUSE_UPDATED,
          payload: [JSON.stringify(result.data)],
        });
      });
    } else {
      const response = await request("POST", `/api/warehouses`, data);

      requestWithErrorHandling(response, form, (result) => {
        onSuccess();
        console.log(`Warehouse id: ${result?.id}`);
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
        <div className="gap-4">
          <Controller
            name="search_address"
            control={form.control}
            disabled={geocodeQuery.isFetching}
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

                    console.log("Selected Address:", selectedAddress);

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

                    form.setValue("city", selectedAddress.address.city || "");

                    form.setValue("state", selectedAddress.address.state || "");

                    form.setValue(
                      "zip_code",
                      selectedAddress.address.postcode || "",
                    );

                    const newLatitude = Number(selectedAddress.lat);
                    const newLongitude = Number(selectedAddress.lon);

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
                          key={item}
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
                  State<span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  {...field}
                  id="state"
                  type="text"
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter State"
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
