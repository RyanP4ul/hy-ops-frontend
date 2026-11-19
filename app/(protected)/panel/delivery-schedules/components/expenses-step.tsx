"use client";

import { useId, useMemo, useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import {
  AlertTriangle,
  Calculator,
  ChevronDown,
  Clock,
  Fuel,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  SlidersHorizontal,
} from "lucide-react";
import {
  DeliveryEstimateMap,
  type RouteMapStop,
} from "@/components/delivery-estimate-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/date-util";
import { useDeliverySchedule } from "../provider";

function parseCoordinate(
  lat: string | null | undefined,
  lng: string | null | undefined,
): [number, number] | null {
  if (!lat?.trim() || !lng?.trim()) return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }
  return [longitude, latitude];
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins} min`;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export function ExpensesStep() {
  const {
    form,
    warehouseQuery,
    orderDetailQuery,
    driverExpensesMutation,
    expenseSettings,
  } = useDeliverySchedule();

  const [ratesOpen, setRatesOpen] = useState(false);
  const roundTripId = useId();
  const efficiencyId = useId();
  const fuelPriceId = useId();
  const ratesPanelId = useId();

  const warehouseId = useWatch({ control: form.control, name: "warehouse_id" });
  const orderIds = useWatch({ control: form.control, name: "order_ids" });
  const deliveryAllowance = useWatch({
    control: form.control,
    name: "delivery_allowance",
  });
  const fuel = useWatch({ control: form.control, name: "fuel" });
  const toll = useWatch({ control: form.control, name: "toll" });

  const mapStops = useMemo<RouteMapStop[]>(() => {
    const stops: RouteMapStop[] = [];
    const warehouse = warehouseQuery.data?.rows.find(
      (row) => row.id === warehouseId,
    );
    const warehouseCoords = parseCoordinate(
      warehouse?.latitude,
      warehouse?.longitude,
    );
    if (warehouse && warehouseCoords) {
      stops.push({
        id: warehouse.id,
        coordinates: warehouseCoords,
        label: warehouse.name,
        kind: "warehouse",
      });
    }
    const orders = orderDetailQuery.data ?? [];
    (orderIds ?? []).forEach((orderId, idx) => {
      const order = orders.find((row) => row.id === orderId);
      const coords = parseCoordinate(
        order?.shipping_latitude,
        order?.shipping_longitude,
      );
      if (order && coords) {
        stops.push({
          id: order.id,
          coordinates: coords,
          label: order.order_number || `Stop ${idx + 1}`,
          kind: "stop",
          index: idx + 1,
        });
      }
    });
    return stops;
  }, [warehouseQuery.data?.rows, warehouseId, orderDetailQuery.data, orderIds]);

  const estimate = driverExpensesMutation.data;
  const isPending = driverExpensesMutation.isPending;

  const isStale = Boolean(
    estimate &&
      (estimate.route.isRoundTrip !== expenseSettings.values.isRoundTrip ||
        Number(expenseSettings.values.fuelConsumptionKmPerLiter) !==
          estimate.expenses.fuelConsumptionKmPerLiter ||
        Number(expenseSettings.values.fuelPricePerLiter) !==
          estimate.expenses.fuelPricePerLiter ||
        (mapStops.length > 0 &&
          estimate.route.inputPointCount !== mapStops.length)),
  );

  const tollUnknown =
    estimate?.expenses.estimatedTollFee === null && !Number.isFinite(toll);

  const safeAllowance = Number.isFinite(deliveryAllowance)
    ? deliveryAllowance
    : 0;
  const safeFuel = Number.isFinite(fuel) ? fuel : 0;
  const safeToll = Number.isFinite(toll) ? toll : 0;
  const knownTotal = safeAllowance + safeFuel + safeToll;

  const stopCount = (orderIds ?? []).length;
  const efficiencyText = expenseSettings.values.fuelConsumptionKmPerLiter;
  const fuelPriceText = expenseSettings.values.fuelPricePerLiter;

  return (
    <div className="space-y-4">
      {/* Top Route Map Card */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <DeliveryEstimateMap
          clean
          coordinates={estimate?.route.geometry.coordinates ?? []}
          stops={mapStops}
          isRoundTrip={expenseSettings.values.isRoundTrip}
          className="h-52 rounded-none border-0 sm:h-60"
        />

        {/* Route Metrics + Calculate Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t bg-background px-3.5 py-2.5">
          {estimate ? (
            <div
              role="status"
              className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs font-medium"
            >
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Route
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                {estimate.route.distanceKm.toFixed(1)} km
              </span>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Clock
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                {formatDuration(estimate.route.durationMinutes)}
              </span>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Fuel
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                {estimate.expenses.estimatedFuelLiters.toFixed(1)} L
              </span>
              {tollUnknown ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                >
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  Enter toll
                </Badge>
              ) : estimate.tollDetection.hasToll ? (
                <Badge variant="secondary">Tolls</Badge>
              ) : (
                <Badge variant="outline">No tolls</Badge>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              <span>
                {stopCount} {stopCount === 1 ? "stop" : "stops"}
              </span>
            </div>
          )}

          <Button
            type="button"
            size="sm"
            variant={!estimate || isStale ? "default" : "outline"}
            onClick={() => driverExpensesMutation.mutate()}
            disabled={isPending || expenseSettings.config.isPending}
            className="ml-auto shrink-0"
          >
            {isPending ? (
              <Loader2
                className="mr-1.5 size-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : estimate ? (
              <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
            ) : (
              <Calculator className="mr-1.5 size-3.5" aria-hidden="true" />
            )}
            {isPending
              ? "Calculating..."
              : estimate
                ? "Recalculate"
                : "Calculate"}
          </Button>
        </div>

        {driverExpensesMutation.error && (
          <div
            role="alert"
            className="border-t bg-destructive/10 px-3.5 py-2 text-xs text-destructive"
          >
            {driverExpensesMutation.error.message}
          </div>
        )}
      </div>

      {/* Compact Trip & Fuel Settings */}
      <div className="rounded-xl border bg-muted/25 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Switch
              id={roundTripId}
              checked={expenseSettings.values.isRoundTrip}
              onCheckedChange={(checked) =>
                expenseSettings.update({ isRoundTrip: checked })
              }
              disabled={isPending}
            />
            <label
              htmlFor={roundTripId}
              className="cursor-pointer text-sm font-medium select-none"
            >
              Round trip
            </label>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={ratesOpen}
            aria-controls={ratesPanelId}
            onClick={() => setRatesOpen((open) => !open)}
            disabled={isPending}
            className="h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            <span className="tabular-nums">
              {expenseSettings.config.isPending
                ? "Fuel rates..."
                : `${efficiencyText || "—"} km/L · ₱${fuelPriceText || "—"}/L`}
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                ratesOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </Button>
        </div>

        {ratesOpen && (
          <fieldset
            id={ratesPanelId}
            disabled={isPending}
            className="mt-3 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2"
          >
            <legend className="sr-only">Fuel rates</legend>
            <Field>
              <FieldLabel htmlFor={efficiencyId}>Efficiency (km/L)</FieldLabel>
              <Input
                id={efficiencyId}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                value={expenseSettings.values.fuelConsumptionKmPerLiter}
                onChange={(event) =>
                  expenseSettings.update({
                    fuelConsumptionKmPerLiter: event.target.value,
                  })
                }
                className="bg-background tabular-nums"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={fuelPriceId}>Fuel price (₱/L)</FieldLabel>
              <Input
                id={fuelPriceId}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={expenseSettings.values.fuelPricePerLiter}
                onChange={(event) =>
                  expenseSettings.update({
                    fuelPricePerLiter: event.target.value,
                  })
                }
                className="bg-background tabular-nums"
              />
            </Field>
          </fieldset>
        )}

        {expenseSettings.config.error && (
          <div
            role="alert"
            className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-xs text-destructive"
          >
            <span>{expenseSettings.config.error.message}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => expenseSettings.config.refetch()}
            >
              Retry
            </Button>
          </div>
        )}
      </div>

      {/* Expense Amounts */}
      <fieldset disabled={isPending} className="space-y-3">
        <legend className="sr-only">Delivery expenses</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Controller
            control={form.control}
            name="delivery_allowance"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="delivery_allowance">
                  Allowance <span className="text-destructive">*</span>
                </FieldLabel>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                  >
                    ₱
                  </span>
                  <Input
                    {...field}
                    id="delivery_allowance"
                    type="number"
                    inputMode="decimal"
                    enterKeyHint="next"
                    min={0}
                    step="0.01"
                    required
                    value={Number.isFinite(field.value) ? field.value : ""}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    className="pl-7 tabular-nums"
                    onChange={(event) => {
                      field.onChange(event.target.valueAsNumber);
                    }}
                  />
                </div>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="fuel"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="fuel">
                  Fuel <span className="text-destructive">*</span>
                </FieldLabel>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                  >
                    ₱
                  </span>
                  <Input
                    {...field}
                    id="fuel"
                    type="number"
                    inputMode="decimal"
                    enterKeyHint="next"
                    min={0}
                    step="0.01"
                    required
                    value={Number.isFinite(field.value) ? field.value : ""}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    className="pl-7 tabular-nums"
                    onChange={(event) => {
                      field.onChange(event.target.valueAsNumber);
                    }}
                  />
                </div>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="toll"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="toll">Toll</FieldLabel>
                  {tollUnknown && (
                    <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                      Manual
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                  >
                    ₱
                  </span>
                  <Input
                    {...field}
                    id="toll"
                    type="number"
                    inputMode="decimal"
                    enterKeyHint="done"
                    min={0}
                    step="0.01"
                    placeholder={tollUnknown ? "0.00" : undefined}
                    value={Number.isFinite(field.value) ? field.value : ""}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    className={cn(
                      "pl-7 tabular-nums",
                      tollUnknown &&
                        !fieldState.invalid &&
                        "border-amber-500/60 focus-visible:border-amber-500",
                    )}
                    onChange={(event) => {
                      field.onChange(event.target.valueAsNumber);
                    }}
                  />
                </div>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
      </fieldset>

      {/* Compact Total Summary */}
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">Total</span>
        <span className="text-xl font-semibold tracking-tight tabular-nums">
          {Number.isFinite(toll)
            ? formatCurrency(knownTotal)
            : `${formatCurrency(safeAllowance + safeFuel)} + toll`}
        </span>
      </div>
    </div>
  );
}
