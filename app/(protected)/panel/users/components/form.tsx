"use client";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QueryFeedback } from "@/components/query-feedback";
import { Input } from "@/components/ui/input";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useUser } from "../provider";
import type { UserForm } from "@/schema/user";
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
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";

export default function Form() {
  const {
    form,
    userQuery,
    userDetailQuery,
    selected,
    warehouseCB,
    warehouseQuery,
    geocodeQuery,
    searchAddress,
    setSearchAddress,
  } = useUser();
  const { state, dispatch } = useModal();
  const role = useWatch({ control: form.control, name: "role" });
  const initialized = useRef<string | null>(null);

  const address_line = form.watch("profile.address_line");
  const barangay = form.watch("profile.barangay");
  const city_municipality = form.watch("profile.city_municipality");
  const province = form.watch("profile.province");
  const postal_code = form.watch("profile.postal_code");

  useEffect(() => {
    if (!state.isOpen) { initialized.current = null; return; }
    const key = `${state.mode}:${selected.id}:${selected.version}`;
    if (initialized.current === key) return;
    if (state.mode === DialogMode.EDIT && (userDetailQuery.isFetching || !userDetailQuery.data)) return;
    initialized.current = key;
    if (state.mode === DialogMode.EDIT && userDetailQuery.data) {
      const base = {
        name: userDetailQuery.data.name,
        email: userDetailQuery.data.email,
        role: userDetailQuery.data.role,
      };

      if (userDetailQuery.data.role === "staff") {
        form.reset({
          name: userDetailQuery.data.name,
          email: userDetailQuery.data.email,
          role: userDetailQuery.data.role,
          profile: {
            warehouse_id: userDetailQuery.data.profile?.warehouse_id ?? -1,
            warehouse_name: userDetailQuery.data.profile?.warehouse_name ?? "",
          },
        });

        warehouseCB.setInputValue(
          userDetailQuery.data.profile?.warehouse_name ?? "",
        );
      } else if (userDetailQuery.data.role === "customer") {
        form.reset({
          name: userDetailQuery.data.name,
          email: userDetailQuery.data.email,
          role: userDetailQuery.data.role,
          profile: {
            search_address: "",
            company_name: userDetailQuery.data.profile?.company_name ?? "",
            phone_number: userDetailQuery.data.profile?.phone_number ?? "",
            address_line: userDetailQuery.data.profile?.address_line ?? "",
            barangay: userDetailQuery.data.profile?.barangay ?? "",
            city_municipality:
              userDetailQuery.data.profile?.city_municipality ?? "",
            province: userDetailQuery.data.profile?.province ?? "",
            postal_code: userDetailQuery.data.profile?.postal_code ?? "",
            latitude: userDetailQuery.data.profile?.latitude ?? "",
            longitude: userDetailQuery.data.profile?.longitude ?? "",
          },
        });
      } else if (userDetailQuery.data.role === "driver") {
        form.reset({
          name: userDetailQuery.data.name,
          email: userDetailQuery.data.email,
          role: userDetailQuery.data.role,
          profile: {
            warehouse_id: userDetailQuery.data.profile?.warehouse_id ?? -1,
            status: userDetailQuery.data.profile?.status ?? "available",
            phone_number: userDetailQuery.data.profile?.phone_number ?? "",
            warehouse_name: userDetailQuery.data.profile?.warehouse_name ?? "",
          },
        });

        warehouseCB.setInputValue(
          userDetailQuery.data.profile?.warehouse_name ?? "",
        );
      } else {
        form.reset(base);
      }

    } else {
      form.reset({
        name: "",
        email: "",
        role: "customer",
      });
    }
  }, [state.isOpen, state.mode, selected.id, selected.version, userDetailQuery.isFetching, userDetailQuery.data, form, warehouseCB]);

  const onSuccess = () => {
    userQuery.refetch();

    if (selected.id > 0) {
      userDetailQuery.refetch();
    }

    dispatch({
      type: "CLOSE",
    });
  };

  async function onSubmit(data: UserForm) {
    form.clearErrors("root");
    const editing = state.mode === DialogMode.EDIT && selected.id > 0;
    const response = await request(editing ? "PUT" : "POST", editing ? `/api/users/${selected.id}?version=${selected.version}` : "/api/users", data);
    await requestWithErrorHandling(response, form, onSuccess);
  }

  const debouncedSearch = useMemo(
    () => debounce(setSearchAddress, 500),
    [setSearchAddress],
  );

  return (
    <>
      <div className="space-y-4">
        <form
          id="form"
          onSubmit={form.handleSubmit(onSubmit, (error) =>
            ToastValidationError(error),
          )}
          className="space-y-4"
        >
          {state.mode === DialogMode.EDIT && <QueryFeedback query={userDetailQuery} label="user details" />}
          {form.formState.errors.root?.message && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Controller
              name="name"
              control={form.control}
              disabled={
                (state.mode === DialogMode.EDIT &&
                  userDetailQuery.isFetching) ||
                userDetailQuery.isFetching
              }
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="name">
                    Name
                    <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id="name"
                    type="text"
                    aria-invalid={fieldState.invalid}
                    placeholder="Enter Name"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="email"
              control={form.control}
              disabled={
                (state.mode === DialogMode.EDIT &&
                  userDetailQuery.isFetching) ||
                userDetailQuery.isFetching
              }
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="email">
                    Email<span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id="email"
                    type="text"
                    aria-invalid={fieldState.invalid}
                    placeholder="Enter Email"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="role"
              control={form.control}
              disabled={
                (state.mode === DialogMode.EDIT &&
                  userDetailQuery.isFetching) ||
                userDetailQuery.isFetching
              }
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="role">
                    Role
                    <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Combobox
                    items={["admin", "staff", "customer", "driver"]}
                    value={field.value}
                    onValueChange={(value) => {
                      if (!value || value === field.value) return;
                      warehouseCB.setInputValue("");
                      if (value === "staff") form.setValue("profile", { warehouse_id: -1, warehouse_name: "" });
                      if (value === "driver") form.setValue("profile", { warehouse_id: -1, warehouse_name: "", status: "available", phone_number: "" });
                      if (value === "customer") form.setValue("profile", { search_address: "", company_name: "", phone_number: "", address_line: "", barangay: "", city_municipality: "", province: "", postal_code: "", latitude: "", longitude: "" });
                      field.onChange(value);
                    }}
                  >
                    <ComboboxInput
                      id="role"
                      aria-invalid={fieldState.invalid}
                      placeholder="Select a role"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No items found.</ComboboxEmpty>
                      <ComboboxList>
                        {(item) => (
                          <ComboboxItem
                            key={item}
                            value={item}
                            className="capitalize"
                          >
                            {item}
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
          {state.mode === DialogMode.INSERT && role !== "customer" && (
            <Controller
              name="password"
              control={form.control}
              disabled={
                userDetailQuery.isFetching || userDetailQuery.isFetching
              }
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="password">
                    Password<span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id="password"
                    type="password"
                    aria-invalid={fieldState.invalid}
                    placeholder="Enter Password"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}
          {(role === "staff" || role === "driver") && (
            <Controller
              name="profile.warehouse_id"
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
                            <ComboboxEmpty>No found.</ComboboxEmpty>
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

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                </Combobox>
              )}
            />
          )}

          {role === "driver" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Controller
                name="profile.status"
                control={form.control}
                disabled={
                  (state.mode === DialogMode.EDIT &&
                    userDetailQuery.isFetching) ||
                  userDetailQuery.isFetching
                }
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="status">
                      Status
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Combobox
                      items={[
                        "available",
                        "unavailable",
                        "day_off",
                        "on_delivery",
                        "on_break",
                        "on_leave",
                        "on_accident",
                        "on_personal_leave",
                        "on_sick_leave",
                      ]}
                      value={field.value}
                      onValueChange={(value) => {
                          field.onChange(value);
                      }}
                    >
                      <ComboboxInput
                        id="status"
                        aria-invalid={fieldState.invalid}
                        placeholder="Select a status"
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>No items found.</ComboboxEmpty>
                        <ComboboxList>
                          {(item) => (
                            <ComboboxItem key={item} value={item}>
                              {item}
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
              <Controller
                name="profile.phone_number"
                control={form.control}
                disabled={
                  (state.mode === DialogMode.EDIT &&
                    userDetailQuery.isFetching) ||
                  userDetailQuery.isFetching
                }
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="phone_number">
                      Phone Number
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      {...field}
                      id="phone_number"
                      type="text"
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter Phone Number"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          )}
          {role === "customer" && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Controller
                  name="profile.company_name"
                  control={form.control}
                  disabled={
                    (state.mode === DialogMode.EDIT &&
                      userDetailQuery.isFetching) ||
                    userDetailQuery.isFetching
                  }
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="company_name">
                        Company Name
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        {...field}
                        id="company_name"
                        type="text"
                        aria-invalid={fieldState.invalid}
                        placeholder="Enter Company Name"
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="profile.phone_number"
                  control={form.control}
                  disabled={
                    (state.mode === DialogMode.EDIT &&
                      userDetailQuery.isFetching) ||
                    userDetailQuery.isFetching
                  }
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="phone_number">
                        Phone Number
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        {...field}
                        id="phone_number"
                        type="text"
                        aria-invalid={fieldState.invalid}
                        placeholder="Enter Phone Number"
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="profile.search_address"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="search_address">
                      Search Address
                    </FieldLabel>

                    <Combobox
                      value={field.value ?? ""}
                      items={geocodeQuery.data ?? []}
                      aria-invalid={fieldState.invalid}
                      onValueChange={(value) => {
                        // Keep React Hook Form synchronized.
                        field.onChange(value);

                        const selectedAddress = geocodeQuery.data?.find(
                          (item) => String(item.place_id) === String(value),
                        );

                        if (!selectedAddress) {
                          console.warn(
                            "Address not found for selected ID:",
                            value,
                          );
                          return;
                        }

                        const address = selectedAddress.address;

                        const street = [address.house_number, address.road]
                          .filter(Boolean)
                          .join(" ");

                        form.setValue(
                          "profile.address_line",
                          street || selectedAddress.display_name || "",
                          { shouldDirty: true, shouldValidate: true },
                        );

                        form.setValue(
                          "profile.barangay",
                          address.suburb ??
                            address.neighbourhood ??
                            address.village ??
                            "",
                          { shouldDirty: true, shouldValidate: true },
                        );

                        form.setValue(
                          "profile.city_municipality",
                          address.city ??
                            address.town ??
                            address.municipality ??
                            address.village ??
                            "",
                          { shouldDirty: true, shouldValidate: true },
                        );

                        form.setValue(
                          "profile.province",
                          address.state ?? address.province ?? "",
                          { shouldDirty: true, shouldValidate: true },
                        );

                        form.setValue(
                          "profile.postal_code",
                          address.postcode ?? "",
                          { shouldDirty: true, shouldValidate: true },
                        );

                        form.setValue(
                          "profile.latitude",
                          selectedAddress.lat ?? "0",
                          { shouldDirty: true, shouldValidate: true },
                        );

                        form.setValue(
                          "profile.longitude",
                          selectedAddress.lon ?? "0",
                          { shouldDirty: true, shouldValidate: true },
                        );
                      }}
                    >
                      <ComboboxInput
                        id="search_address"
                        placeholder="Search customer address..."
                        onChange={(event) => {
                          debouncedSearch(event.target.value);
                        }}
                      />

                      <ComboboxContent>
                        <ComboboxEmpty>No address found.</ComboboxEmpty>

                        <ComboboxList>
                          {(item) => (
                            <ComboboxItem
                              key={item.place_id}
                              value={String(item.place_id)}
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Controller
                  name="profile.address_line"
                  control={form.control}
                  disabled={
                    (state.mode === DialogMode.EDIT &&
                      userDetailQuery.isFetching) ||
                    userDetailQuery.isFetching
                  }
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="profile.address_line">
                        Address
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        {...field}
                        id="profile.address_line"
                        type="text"
                        aria-invalid={fieldState.invalid}
                        placeholder="Enter Address Line"
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="profile.barangay"
                  control={form.control}
                  disabled={
                    (state.mode === DialogMode.EDIT &&
                      userDetailQuery.isFetching) ||
                    userDetailQuery.isFetching
                  }
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="profile.barangay">
                        Barangay
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        {...field}
                        id="profile.barangay"
                        type="text"
                        aria-invalid={fieldState.invalid}
                        placeholder="Enter Barangay"
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="profile.city_municipality"
                  control={form.control}
                  disabled={
                    (state.mode === DialogMode.EDIT &&
                      userDetailQuery.isFetching) ||
                    userDetailQuery.isFetching
                  }
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="profile.city_municipality">
                        City/Municipality
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        {...field}
                        id="profile.city_municipality"
                        type="text"
                        aria-invalid={fieldState.invalid}
                        placeholder="Enter City/Municipality"
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Controller
                  name="profile.province"
                  control={form.control}
                  disabled={
                    (state.mode === DialogMode.EDIT &&
                      userDetailQuery.isFetching) ||
                    userDetailQuery.isFetching
                  }
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="profile.province">
                        Province
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        {...field}
                        id="profile.province"
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
                  name="profile.postal_code"
                  control={form.control}
                  disabled={
                    (state.mode === DialogMode.EDIT &&
                      userDetailQuery.isFetching) ||
                    userDetailQuery.isFetching
                  }
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="profile.postal_code">
                        Postal Code
                      </FieldLabel>
                      <Input
                        {...field}
                        id="profile.postal_code"
                        type="text"
                        aria-invalid={fieldState.invalid}
                        placeholder="Enter Postal Code"
                        autoComplete="off"
                        onChange={(event) => {
                          field.onChange(event.target.value);
                        }}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </>
          )}
        </form>
      </div>
    </>
  );
}
