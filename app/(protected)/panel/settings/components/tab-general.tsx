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

export default function TabGeneral() {
  const { settingQuery, isModified, setIsModified } = useSetting();

  const form = useForm<GeneralSettingSchema>({
    resolver: zodResolver(generalSettingSchema),
    defaultValues: {
      is_form_validation_debug_enabled: false,
      refresh_interval_ms: 30000,
    },
  });

  useEffect(() => {
    if (settingQuery.data) {
      form.reset({
        is_form_validation_debug_enabled:
          settingQuery.data?.is_form_validation_debug_enabled.value === "true",
        refresh_interval_ms:
          Number(settingQuery.data?.refresh_interval_ms.value) ?? 30000,
      });
    }
  }, [settingQuery.data, form]);

  async function onSubmit(data: any) {
    const setting_changes = [
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
    ];

    ToastSubmit(setting_changes);

    requestWithErrorHandling(
      await request("POST", `/api/settings`, setting_changes),
      form,
      (_) => {
        setIsModified(false);
        settingQuery.refetch();
      },
    );
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
                        console.log(`Switch toggled to ${checked}`);
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
