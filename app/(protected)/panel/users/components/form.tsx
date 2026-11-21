"use client";

import { Button } from "@/components/ui/button";
import { QueryFeedback } from "@/components/query-feedback";
import { Input } from "@/components/ui/input";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useUser } from "../provider";
import { emptyCustomerProfile, type UserForm } from "@/schema/user";
import { CustomerAddressFields, CustomerContactFields, UserTextField } from "@/components/customer-profile-fields";
import { useEffect, useRef } from "react";
import { Controller, useWatch } from "react-hook-form";
import { ToastValidationError } from "@/components/util";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { request, requestWithErrorHandling } from "@/components/http";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";

export default function Form() {
  const {
    form,
    userQuery,
    userDetailQuery,
    selected,
    warehouseCB,
    warehouseQuery,
  } = useUser();
  const { state, dispatch } = useModal();
  const role = useWatch({ control: form.control, name: "role" });
  const initialized = useRef<string | null>(null);

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
        profile: emptyCustomerProfile,
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

  const loadingUser = userDetailQuery.isFetching;

  return (
    <>
      <div className="space-y-4">
        <form
          id="form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit, (error) =>
            ToastValidationError(error),
          )}
          className="space-y-4"
        >
          {state.mode === DialogMode.EDIT && <QueryFeedback query={userDetailQuery} label="user details" />}
          {form.formState.errors.root?.message && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <UserTextField control={form.control} name="name" label="Name" placeholder="Enter name" autoComplete="name" required disabled={loadingUser} />
            <UserTextField control={form.control} name="email" label="Email" placeholder="Enter email" type="email" autoComplete="email" required disabled={loadingUser} />
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
                      if (value === "customer") form.setValue("profile", emptyCustomerProfile);
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
              <CustomerContactFields control={form.control} disabled={loadingUser} />
              <CustomerAddressFields form={form} disabled={loadingUser} />
            </>
          )}
        </form>
      </div>
    </>
  );
}
