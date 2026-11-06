"use client";

import { Boxes } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { stockStatusSchema, type StockStatusSchema } from "@/schema/setting";
import { useSetting } from "@/components/providers/setting-provider";
import { NumberSetting, SettingsActions, SettingsSection, useSettingsForm } from "./settings-form";

function readSettings(data: NonNullable<ReturnType<typeof useSetting>["settingQuery"]["data"]>): StockStatusSchema {
  return {
    low_stock_threshold: Number(data.low_stock_threshold?.value ?? 10),
    high_stock_threshold: Number(data.high_stock_threshold?.value ?? 100),
  };
}

export default function TabInventory() {
  const { settingQuery } = useSetting();
  const form = useForm<StockStatusSchema>({
    resolver: zodResolver(stockStatusSchema),
    defaultValues: settingQuery.data ? readSettings(settingQuery.data) : undefined,
  });
  const { save, discard } = useSettingsForm(form, readSettings);
  const { isDirty, isSubmitting, errors } = form.formState;

  return (
    <form id="inventory-settings-form" onSubmit={form.handleSubmit(save)} className="space-y-6" noValidate>
      <div><h2 className="text-lg font-semibold">Inventory settings</h2><p className="mt-1 text-sm text-muted-foreground">Define the stock levels that matter to your team.</p></div>
      <fieldset disabled={isSubmitting} className="min-w-0 disabled:opacity-70">
        <SettingsSection title="Stock thresholds" description="Choose when an item is classified as low or high stock." icon={Boxes}>
          <div className="grid gap-8 sm:grid-cols-2">
            <NumberSetting control={form.control} name="low_stock_threshold" label="Low stock threshold" description="Items at or below this quantity are considered low stock." unit="items" />
            <NumberSetting control={form.control} name="high_stock_threshold" label="High stock threshold" description="Items at or above this quantity are considered high stock." unit="items" />
          </div>
          <div role="group" className="mt-6 grid gap-3 rounded-lg bg-muted/60 p-4 text-xs sm:grid-cols-3" aria-label="Stock level guide">
            <p className="flex items-center gap-2"><span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />Low: at or below the low threshold</p>
            <p className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />Normal: between thresholds</p>
            <p className="flex items-center gap-2"><span className="size-2 rounded-full bg-sky-500" aria-hidden="true" />High: at or above the high threshold</p>
          </div>
        </SettingsSection>
      </fieldset>
      <SettingsActions dirty={isDirty} saving={isSubmitting} error={errors.root?.message} onDiscard={discard} />
    </form>
  );
}
