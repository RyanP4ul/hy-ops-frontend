"use client";

import { Input } from "@/components/ui/input";
import React, { useEffect } from "react";
import { useSetting } from "@/components/providers/setting-provider";
import { Controller, useForm } from "react-hook-form";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { zodResolver } from "@hookform/resolvers/zod";
import { generalSettingSchema, GeneralSettingSchema } from "@/schema/setting";
import { ToastSubmit, ToastValidationError } from "@/components/util";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { request, requestWithErrorHandling } from "@/components/http";

function parseSettingNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function TabGeneral() {
  const { settingQuery, isModified, setIsModified } = useSetting();

  const form = useForm<GeneralSettingSchema>({
    resolver: zodResolver(generalSettingSchema),
    defaultValues: {
      is_form_validation_debug_enabled: false,
      refresh_interval_ms: 30000,
      mobile_automatic_refresh_interval_ms: 30000,
      order_limit_per_day: 10,
      customer_order_limit: 1,
      max_order_per_vehicle: 5,
      returning_automatic_confirm_ms_interval: 100,
    },
  });

  useEffect(() => {
    if (settingQuery.data) {
      form.reset({
        mobile_automatic_refresh_interval_ms: parseSettingNumber(
          settingQuery.data?.mobile_automatic_refresh_interval_ms?.value,
          30000,
        ),
        returning_automatic_confirm_ms_interval: parseSettingNumber(
          settingQuery.data?.returning_automatic_confirm_ms_interval?.value,
          100,
        ),
        is_form_validation_debug_enabled:
          settingQuery.data?.is_form_validation_debug_enabled.value === "true",
        refresh_interval_ms: parseSettingNumber(
          settingQuery.data?.refresh_interval_ms.value,
          30000,
        ),
        order_limit_per_day: parseSettingNumber(
          settingQuery.data?.order_limit_per_day.value,
          10,
        ),
        customer_order_limit: parseSettingNumber(
          settingQuery.data?.customer_order_limit.value,
          1,
        ),
        max_order_per_vehicle: parseSettingNumber(
          settingQuery.data?.max_order_per_vehicle.value,
          5,
        ),
      });
    }
  }, [settingQuery.data, form]);

  async function onSubmit(data: GeneralSettingSchema) {
    const setting_changes = [
      {
        name: "mobile_automatic_refresh_interval_ms",
        value: data.mobile_automatic_refresh_interval_ms.toString(),
        version: settingQuery.data?.mobile_automatic_refresh_interval_ms?.version ?? 1,
      },
      {
        name: "returning_automatic_confirm_ms_interval",
        value: data.returning_automatic_confirm_ms_interval.toString(),
        version: settingQuery.data?.returning_automatic_confirm_ms_interval?.version ?? 1,
      },
      {
        name: "is_form_validation_debug_enabled",
        value: data.is_form_validation_debug_enabled.toString(),
        version:
          settingQuery.data?.is_form_validation_debug_enabled.version ?? 1,
      },
      {
        name: "refresh_interval_ms",
        value: data.refresh_interval_ms.toString(),
        version: settingQuery.data?.refresh_interval_ms.version ?? 1,
      },
      {
        name: "order_limit_per_day",
        value: data.order_limit_per_day.toString(),
        version: settingQuery.data?.order_limit_per_day.version ?? 1,
      },
      {
        name: "customer_order_limit",
        value: data.customer_order_limit.toString(),
        version: settingQuery.data?.customer_order_limit.version ?? 1,
      },
      {
        name: "max_order_per_vehicle",
        value: data.max_order_per_vehicle.toString(),
        version: settingQuery.data?.max_order_per_vehicle.version ?? 1,
      },
    ];

    ToastSubmit(setting_changes);

    const response = await request("POST", `/api/settings`, setting_changes);
    await requestWithErrorHandling(response, form, () => {
      setIsModified(false);
      void settingQuery.refetch();
    });
  }

  return (
    <form
      id="form"
      onSubmit={form.handleSubmit(onSubmit, (error) =>
        ToastValidationError(error),
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Manage your general settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <FieldGroup className="grid grid-cols-1 items-center gap-4">
              <Controller
                name="mobile_automatic_refresh_interval_ms"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="mobile_automatic_refresh_interval_ms">Mobile Automatic Refresh Interval (milliseconds)</FieldLabel>
                    <Input
                      id="mobile_automatic_refresh_interval_ms"
                      type="number"
                      min={1}
                      max={2147483647}
                      step={1}
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.valueAsNumber);
                        setIsModified(true);
                      }}
                      aria-invalid={fieldState.invalid}
                      aria-describedby="mobile-refresh-description"
                    />
                    <FieldDescription id="mobile-refresh-description">
                      Controls how often the driver app refreshes its data. Default: 30000 milliseconds (30 seconds). Enter a positive whole number. Restart the driver app or sign in again to load a saved change.
                    </FieldDescription>
                    {fieldState.error && <p role="alert" className="text-sm text-destructive">Enter a whole number from 1 to 2147483647 milliseconds.</p>}
                  </Field>
                )}
              />
              <Controller
                name="returning_automatic_confirm_ms_interval"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="returning_automatic_confirm_ms_interval">Automatic Return Confirmation Distance (metres)</FieldLabel>
                    <Input
                      id="returning_automatic_confirm_ms_interval"
                      type="number"
                      min={50}
                      max={1000}
                      step={1}
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.valueAsNumber);
                        setIsModified(true);
                      }}
                      aria-invalid={fieldState.invalid}
                      aria-describedby="return-distance-description"
                    />
                    <FieldDescription id="return-distance-description">
                      Recommended: 100 metres. The vehicle distance plus GPS accuracy margin must fit inside this radius of its assigned warehouse. Allowed: 50–1000 metres. Changes apply to the next GPS update. Failed deliveries require manual confirmation.
                    </FieldDescription>
                    {fieldState.error && <p role="alert" className="text-sm text-destructive">Enter a whole number from 50 to 1000 metres.</p>}
                  </Field>
                )}
              />
              <Controller
                name="is_form_validation_debug_enabled"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="is_form_validation_debug_enabled">
                        Form Validation Debug
                      </FieldLabel>

                      <FieldDescription>
                        Enable this to log form validation errors to the console
                        for debugging purposes.
                      </FieldDescription>
                    </FieldContent>

                    <Switch
                      id="is_form_validation_debug_enabled"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        setIsModified(true);
                      }}
                    />
                  </Field>
                )}
              />

              <Controller
                name="refresh_interval_ms"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Refresh Interval (milliseconds)</FieldLabel>

                    <Input
                      type="number"
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.valueAsNumber);
                        setIsModified(true);
                      }}
                      aria-invalid={fieldState.invalid}
                    />

                    <FieldDescription>
                      The interval is used for real-time updates.
                    </FieldDescription>
                  </Field>
                )}
              />

              <Controller
                name="order_limit_per_day"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Order Limit Per Day</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.valueAsNumber);
                        setIsModified(true);
                      }}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>
                      Maximum number of orders allowed per day.
                    </FieldDescription>
                  </Field>
                )}
              />

              <Controller
                name="customer_order_limit"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Customer Order Limit</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.valueAsNumber);
                        setIsModified(true);
                      }}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>
                      Maximum number of active orders allowed per customer.
                    </FieldDescription>
                  </Field>
                )}
              />

              <Controller
                name="max_order_per_vehicle"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Maximum Orders Per Vehicle</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.valueAsNumber);
                        setIsModified(true);
                      }}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>
                      Maximum number of orders assigned to one vehicle.
                    </FieldDescription>
                  </Field>
                )}
              />
            </FieldGroup>
          </div>
        </CardContent>
        {isModified && (
          <CardFooter className="flex justify-end">
            <Button
              type="submit"
              variant="default"
              disabled={settingQuery.isFetching}
            >
              Save changes
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  );
}
