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
import { Input } from "@/components/ui/input";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useUser } from "../provider";
import { WarehouseForm as UserForm, warehouseSchema } from "@/schema/warehouse";
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
  const { form, userQuery, userDetailQuery, selected } = useUser();
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const [role, setRole] = useState<string>("none");

  useEffect(() => {
    if (state.mode === DialogMode.EDIT && userDetailQuery.data) {
      const base = {
        name: userDetailQuery.data.name,
        email: userDetailQuery.data.email,
        role: userDetailQuery.data.role,
      };

      if (userDetailQuery.data.role === "customer") {
        form.reset({
          name: userDetailQuery.data.name,
          email: userDetailQuery.data.email,
          role: userDetailQuery.data.role,
          profile: {
            company_name: userDetailQuery.data.profile?.company_name ?? "",
            phone_number: userDetailQuery.data.profile?.phone_number ?? "",
            address: userDetailQuery.data.profile?.address ?? "",
          },
        });
      } else if (userDetailQuery.data.role === "driver") {
        form.reset({
          name: userDetailQuery.data.name,
          email: userDetailQuery.data.email,
          role: userDetailQuery.data.role,
          profile: {
            status: userDetailQuery.data.profile?.status ?? "",
            phone_number: userDetailQuery.data.profile?.phone_number ?? "",
          },
        });
      } else {
        form.reset(base);
      }

      setRole(userDetailQuery.data.role);
    } else {
      form.reset({
        name: "",
        email: "",
        role: "customer",
      });
    }
  }, [state, userDetailQuery.isFetched]);

  const onSuccess = () => {
    userQuery.refetch();

    if (selected.id > 0) {
      userDetailQuery.refetch();
    }

    dispatch({
      type: "CLOSE",
    });
  };

  async function onSubmit(data: any) {
    ToastSubmit(data);

    if (state.mode === DialogMode.EDIT && selected.id > 0) {
      const response = await request(
        "PUT",
        `/api/users/${selected.id}?version=${selected.version}`,
        {
          ...data,
          version: selected.version,
        },
      );
      requestWithErrorHandling(response, form, (result) => {
        onSuccess();
        send({
          type: REQUESTS.USER_UPDATED,
          payload: [
            JSON.stringify({
              id: selected.id,
              ...data,
            }),
          ],
        });
      });
    } else {
      const response = await request("POST", `/api/users`, data);

      requestWithErrorHandling(response, form, (result) => {
        onSuccess();
        console.log(`User id: ${result?.id}`);
        send({
          type: REQUESTS.USER_ADDED,
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
      <div className="space-y-4">
        <form
          id="form"
          onSubmit={form.handleSubmit(onSubmit, (error) =>
            ToastValidationError(error),
          )}
          className="space-y-4"
        >
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
                  <FieldLabel htmlFor="street_address">
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
                    id="name"
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
                      setRole(value as string);
                      field.onChange(value);
                    }}
                  >
                    <ComboboxInput
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
          {state.mode === DialogMode.INSERT && (
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
                        setRole(value as string);
                        field.onChange(value);
                      }}
                    >
                      <ComboboxInput
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
                name="profile.address"
                control={form.control}
                disabled={
                  (state.mode === DialogMode.EDIT &&
                    userDetailQuery.isFetching) ||
                  userDetailQuery.isFetching
                }
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="address">
                      Address
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      {...field}
                      id="address"
                      type="text"
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter Address"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </>
          )}
        </form>
      </div>
    </>
  );
}
