"use client";

import { Controller } from "react-hook-form";
import { useEffect, useRef } from "react";
import { QueryFeedback } from "@/components/query-feedback";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { request, requestWithErrorHandling } from "@/components/http";
import { ToastValidationError } from "@/components/util";
import { useVehicles } from "../provider";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { VehicleForm } from "@/schema/vehicle";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Button } from "@/components/ui/button";

export default function Form() {
  const {
    form,
    vehicleQuery,
    vehicleDetailQuery,
    selected,
    warehouseCB,
    warehouseQuery,
  } = useVehicles();
  const { state, dispatch } = useModal();
  const initialized = useRef<string | null>(null);

  useEffect(() => {
    if (!state.isOpen) { initialized.current = null; return; }
    const key = `${state.mode}:${selected.id}:${selected.version}`;
    if (initialized.current === key) return;
    if (state.mode === DialogMode.EDIT && (vehicleDetailQuery.isFetching || !vehicleDetailQuery.data)) return;
    initialized.current = key;
    if (state.mode === DialogMode.EDIT && vehicleDetailQuery.data) {
      form.reset(vehicleDetailQuery.data);
      warehouseCB.setInputValue(vehicleDetailQuery.data.warehouse_name);
    } else if (state.mode === DialogMode.INSERT) {
      form.reset({
        plate_number: "",
        status: "available",
        type: "truck",
        image: "",
      });
      warehouseCB.setInputValue("");
    }
  }, [form, state.isOpen, state.mode, selected.id, selected.version, vehicleDetailQuery.isFetching, vehicleDetailQuery.data, warehouseCB]);

  async function onSubmit(data: VehicleForm) {
    const response = await request(
      state.mode === DialogMode.EDIT ? "PUT" : "POST",
      state.mode === DialogMode.EDIT
        ? `/api/vehicles/${selected.id}`
        : "/api/vehicles",
      state.mode === DialogMode.EDIT
        ? { ...data, version: selected.version }
        : data,
    );
    await requestWithErrorHandling(response, form, (result) => {
      vehicleQuery.refetch();
      dispatch({ type: "CLOSE" });
    });
  }
  return (
    <form
      id="vehicle-form"
      onSubmit={form.handleSubmit(onSubmit, (error) =>
        ToastValidationError(error),
      )}
      className="grid gap-4 md:grid-cols-2"
    >
      {state.mode === DialogMode.EDIT && <div className="md:col-span-2"><QueryFeedback query={vehicleDetailQuery} label="vehicle details" /></div>}
      <p className="text-sm text-muted-foreground md:col-span-2">Dispatch manages on-delivery status. Vehicles with delivery history are retained. Reassign scheduled trips before changing the vehicle status or warehouse.</p>
      <Controller
        name="warehouse_id"
        control={form.control}
        render={({ field, fieldState }) => (
          <Combobox
            open={warehouseCB.open}
            onOpenChange={(open) => warehouseCB.setOpen(open)}
            value={field.value && field.value > 0 ? String(field.value) : null}
            onValueChange={(value) => {
              const selectedWarehouse = warehouseQuery.data?.rows?.find(
                (warehouse) => warehouse.id === Number(value),
              );

              warehouseCB.setInputValue(selectedWarehouse?.name ?? "");

              field.onChange(value ? Number(value) : null);
            }}
          >
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="warehouse-name">
                Warehouse<span className="text-destructive">*</span>
              </FieldLabel>

              <ComboboxInput
                id="warehouse-name"
                placeholder="Select warehouse name..."
                value={warehouseCB.inputValue}
                disabled={warehouseQuery.isFetching}
                aria-invalid={fieldState.invalid}
                readOnly
              />
              <ComboboxContent>
                <ComboboxList>
                  {warehouseQuery.data?.rows?.map((productVariant) => (
                    <ComboboxItem
                      key={productVariant.id}
                      value={String(productVariant.id)}
                    >
                      <Item size="xs" className="p-0">
                        <ItemContent>
                          <ItemTitle className="whitespace-nowrap">
                            ({productVariant.id}) {productVariant.name}
                          </ItemTitle>
                          
                        </ItemContent>
                      </Item>
                    </ComboboxItem>
                  ))}

                  {warehouseQuery.isFetching && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      Loading...
                    </div>
                  )}

                  {!warehouseQuery.isFetching &&
                    warehouseQuery.data?.rows?.length === 0 && (
                      <ComboboxEmpty>No warehouses found.</ComboboxEmpty>
                    )}
                </ComboboxList>

                <div className="flex items-center justify-between border-t p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={
                      warehouseCB.page <= 0 || warehouseQuery.isFetching
                    }
                    onClick={() => warehouseCB.setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>

                  <span className="text-muted-foreground text-xs">
                    {warehouseCB.page + 1} / {warehouseCB.totalPages}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={
                      warehouseCB.page + 1 >= warehouseCB.totalPages ||
                      warehouseQuery.isFetching
                    }
                    onClick={() => {
                      warehouseCB.setPage((p) => p + 1);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </ComboboxContent>

              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          </Combobox>
        )}
      />
      <Controller
        name="plate_number"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="plate-number">Plate number</FieldLabel>
            <Input id="plate-number" {...field} placeholder="ABC-1234" />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="type"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="vehicle-type">Type</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="vehicle-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="truck">Truck</SelectItem>
                <SelectItem value="van">Van</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="status"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="vehicle-status">Status</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="vehicle-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                {field.value === "on_delivery" && <SelectItem value="on_delivery" disabled>On delivery (managed by dispatch)</SelectItem>}
              </SelectContent>
            </Select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="image"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="vehicle-image">Image path (optional)</FieldLabel>
            <Input id="vehicle-image" {...field} placeholder="/vehicles/truck.svg" />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </form>
  );
}
