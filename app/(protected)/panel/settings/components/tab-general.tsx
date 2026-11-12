"use client";

import { Bug, MapPin, RefreshCw, ShoppingBag } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { generalSettingSchema, type GeneralSettingSchema } from "@/schema/setting";
import { useSetting } from "@/components/providers/setting-provider";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { NumberSetting, SettingsActions, SettingsSection, useSettingsForm } from "./settings-form";

function number(value: string | undefined, fallback: number) {
  const parsed = value?.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readSettings(data: NonNullable<ReturnType<typeof useSetting>["settingQuery"]["data"]>): GeneralSettingSchema {
  return {
    mobile_offline_delivery_recording_enabled: data.mobile_offline_delivery_recording_enabled?.value === "true",
    is_form_validation_debug_enabled: data.is_form_validation_debug_enabled?.value === "true",
    refresh_interval_ms: number(data.refresh_interval_ms?.value, 30000),
    mobile_automatic_refresh_interval_ms: number(data.mobile_automatic_refresh_interval_ms?.value, 30000),
    returning_automatic_confirm_ms_interval: number(data.returning_automatic_confirm_ms_interval?.value, 100),
    order_limit_per_day: number(data.order_limit_per_day?.value, 10),
    max_order_per_vehicle: number(data.max_order_per_vehicle?.value, 5),
  };
}

export default function TabGeneral() {
  const { settingQuery } = useSetting();
  const form = useForm<GeneralSettingSchema>({
    resolver: zodResolver(generalSettingSchema),
    defaultValues: settingQuery.data ? readSettings(settingQuery.data) : undefined,
  });
  const { save, discard } = useSettingsForm(form, readSettings);
  const { isDirty, isSubmitting, errors } = form.formState;

  return (
    <form id="general-settings-form" onSubmit={form.handleSubmit(save)} className="space-y-6" noValidate>
      <div><h2 className="text-lg font-semibold">General settings</h2><p className="mt-1 text-sm text-muted-foreground">Control how your workspace and delivery operations run.</p></div>
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-8 disabled:opacity-70">
        <SettingsSection title="App updates" description="Choose how often your web dashboard and driver app fetch fresh data." icon={RefreshCw}>
          <div className="grid gap-8 sm:grid-cols-2">
            <NumberSetting control={form.control} name="refresh_interval_ms" label="Web refresh interval" description="Time between real-time dashboard updates." unit="ms" hint="30,000 ms = 30 seconds." />
            <NumberSetting control={form.control} name="mobile_automatic_refresh_interval_ms" label="Mobile refresh interval" description="Time between automatic driver app updates." unit="ms" min={1} max={2147483647} step={1} hint="Default: 30,000 ms (30 seconds)." />
          </div>
          <p className="mt-5 rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">After changing the mobile interval, restart the driver app or sign in again to load the saved value.</p>
        </SettingsSection>
        <SettingsSection title="Offline deliveries" description="Let drivers save delivery work when they lose their connection." icon={RefreshCw}>
          <Controller name="mobile_offline_delivery_recording_enabled" control={form.control} render={({ field }) => (
            <Field orientation="horizontal" className="items-center">
              <FieldContent>
                <FieldLabel htmlFor={field.name}>Offline delivery recording</FieldLabel>
                <FieldDescription id="offline-delivery-description">Allow drivers to save proof, delivery outcomes and return collections offline. Saved work synchronizes when connected. Turning this off stops new offline recording; already saved work can still synchronize.</FieldDescription>
              </FieldContent>
              <Switch id={field.name} checked={field.value} onCheckedChange={field.onChange} aria-describedby="offline-delivery-description" />
            </Field>
          )} />
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Save changes, then refresh the driver app while connected to load this setting. Drivers need a remembered sign-in and a downloaded, active trip. Trip start still requires a connection.</p>
        </SettingsSection>
        <SettingsSection title="Order limits" description="Set capacity limits for daily orders and vehicles. Customers can have multiple active orders." icon={ShoppingBag}>
          <div className="grid gap-6 [&>div:not(:first-child)]:border-t [&>div:not(:first-child)]:pt-6">
            <NumberSetting control={form.control} name="order_limit_per_day" label="Daily order limit" description="Maximum number of orders allowed per day." unit="orders" />
            <NumberSetting control={form.control} name="max_order_per_vehicle" label="Orders per vehicle" description="Maximum orders assigned to one vehicle." unit="orders" />
          </div>
        </SettingsSection>
        <SettingsSection title="Return confirmation" description="Automatically confirm a vehicle’s return when it reaches its warehouse." icon={MapPin}>
          <NumberSetting control={form.control} name="returning_automatic_confirm_ms_interval" label="Automatic return confirmation distance" description="The vehicle distance plus its GPS accuracy margin must fit within this radius of its assigned warehouse." unit="metres" min={50} max={1000} step={1} hint="Allowed: 50–1,000 metres. Recommended: 100 metres." />
          <p className="mt-5 rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">Changes apply on the next GPS update. Failed deliveries still require manual confirmation.</p>
        </SettingsSection>
        <SettingsSection title="Diagnostics" description="Tools to help investigate form validation issues." icon={Bug}>
          <Controller name="is_form_validation_debug_enabled" control={form.control} render={({ field }) => (
            <Field orientation="horizontal" className="items-center">
              <FieldContent><FieldLabel htmlFor={field.name}>Form validation debug</FieldLabel><FieldDescription id="debug-description">Log form validation errors to the console for troubleshooting.</FieldDescription></FieldContent>
              <Switch id={field.name} checked={field.value} onCheckedChange={field.onChange} aria-describedby="debug-description" />
            </Field>
          )} />
        </SettingsSection>
      </fieldset>
      <SettingsActions dirty={isDirty} saving={isSubmitting} error={errors.root?.message} onDiscard={discard} />
    </form>
  );
}
