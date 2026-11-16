"use client";

import { useState, useId } from "react";
import { useQuery } from "@tanstack/react-query";

type Values = {
  fuelConsumptionKmPerLiter: string;
  fuelPricePerLiter: string;
  tollFeeOverride: string;
  isRoundTrip: boolean;
};

export function useExpenseSettings(roundTrip = false) {
  const [overrides, setOverrides] = useState<Partial<Values>>({});
  const config = useQuery({
    queryKey: ["delivery-estimate-config"],
    queryFn: async () => {
      const response = await fetch("/api/delivery-estimates/config", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load fuel defaults. Please retry.");
      return response.json() as Promise<{ fuelConsumptionKmPerLiter: number; fuelPricePerLiter: number }>;
    },
    staleTime: 60_000,
  });
  const values: Values = {
    fuelConsumptionKmPerLiter: config.data ? String(config.data.fuelConsumptionKmPerLiter) : "",
    fuelPricePerLiter: config.data ? String(config.data.fuelPricePerLiter) : "",
    tollFeeOverride: "", isRoundTrip: roundTrip, ...overrides,
  };
  function requestOptions() {
    const efficiency = Number(values.fuelConsumptionKmPerLiter);
    const price = Number(values.fuelPricePerLiter);
    const toll = values.tollFeeOverride.trim() ? Number(values.tollFeeOverride) : undefined;
    if (!values.fuelConsumptionKmPerLiter.trim() || !Number.isFinite(efficiency) || efficiency <= 0) throw new Error("Enter fuel efficiency greater than zero.");
    if (!values.fuelPricePerLiter.trim() || !Number.isFinite(price) || price < 0) throw new Error("Enter a non-negative fuel price.");
    if (toll !== undefined && (!Number.isFinite(toll) || toll < 0)) throw new Error("Enter a non-negative toll amount.");
    return { fuelConsumptionKmPerLiter: efficiency, fuelPricePerLiter: price, tollFeeOverride: toll, isRoundTrip: values.isRoundTrip };
  }
  return { values, update: (value: Partial<Values>) => setOverrides(current => ({ ...current, ...value })), requestOptions, config };
}

export function ExpenseSettings({ settings, disabled = false, showTollOverride = true }: {
  settings: ReturnType<typeof useExpenseSettings>; disabled?: boolean; showTollOverride?: boolean;
}) {
  const id = useId();
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="mb-2 text-sm font-medium">Fuel and trip settings</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <label htmlFor={id + "-efficiency"} className="text-sm">Vehicle efficiency (km/L)
        <input id={id + "-efficiency"} type="number" min="0.01" step="any" value={settings.values.fuelConsumptionKmPerLiter}
          onChange={event => settings.update({ fuelConsumptionKmPerLiter: event.target.value })}
          className="mt-1 h-9 w-full rounded-md border bg-background px-3" />
      </label>
      <label htmlFor={id + "-price"} className="text-sm">Fuel price (PHP/L)
        <input id={id + "-price"} type="number" min="0" step="any" value={settings.values.fuelPricePerLiter}
          onChange={event => settings.update({ fuelPricePerLiter: event.target.value })}
          className="mt-1 h-9 w-full rounded-md border bg-background px-3" />
      </label>
      {showTollOverride && <label htmlFor={id + "-toll"} className="text-sm">Manual toll for entire trip (PHP, optional)
        <input id={id + "-toll"} type="number" min="0" step="any" placeholder="Use Google estimate" value={settings.values.tollFeeOverride}
          onChange={event => settings.update({ tollFeeOverride: event.target.value })}
          className="mt-1 h-9 w-full rounded-md border bg-background px-3" />
      </label>}
    </div>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={settings.values.isRoundTrip} onChange={event => settings.update({ isRoundTrip: event.target.checked })} />
      Return to warehouse after the last delivery
    </label>
    <p className="text-xs text-muted-foreground">Fuel cost = Google route distance ÷ vehicle efficiency × fuel price. Allowance follows the company distance tiers. Recalculate after changing settings.</p>
    {settings.config.isPending && <p className="text-sm text-muted-foreground">Loading fuel defaults...</p>}
    {settings.config.error && <p role="alert" className="text-sm text-destructive">{settings.config.error.message} <button type="button" onClick={() => settings.config.refetch()}>Retry</button></p>}
  </fieldset>;
}

