"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PickupWarehouseSelector,
  type PickupFeedback,
} from "./pickup-warehouse-selector";
import type { City, Context, Quotation } from "../types";
import {
  money,
  primaryCtaClass,
  selectInputClass,
  warehouseAddress,
  words,
} from "./shared";

const DELIVERY_METHODS = [
  { value: "INTERNAL", label: "Company" },
  { value: "LALAMOVE", label: "Lalamove" },
] as const;

export function DeliveryDetails({
  data,
  busy,
  saving,
  feedback,
  onSave,
  onMethod,
}: {
  data: Context;
  busy: boolean;
  saving: boolean;
  feedback: PickupFeedback;
  onSave: (warehouseId: number) => void;
  onMethod: (method: string) => void;
}) {
  const hasContact = !!data.warehouse.phone_number?.trim();
  const [editingWarehouse, setEditingWarehouse] = useState(!hasContact);
  const locked =
    data.bookings.some((booking) => booking.active) ||
    !["PENDING", "PROCESSING", "SCHEDULING"].includes(data.order.status);

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      {/* Header + Method Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Route</h2>
          {locked && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              Locked
            </span>
          )}
        </div>

        <div
          role="group"
          aria-label="Delivery method"
          className="inline-flex rounded-lg bg-muted p-0.5"
        >
          {DELIVERY_METHODS.map((item) => {
            const active = data.order.delivery_method === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                disabled={busy || locked}
                onClick={() => onMethod(item.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  active
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pickup -> Drop-off timeline */}
      <div className="space-y-5 p-5">
        <div className="relative space-y-5 pl-6">
          <div
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[5px] w-px bg-border"
          />

          {/* Pickup */}
          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute top-1.5 -left-6 size-2.5 rounded-full border-2 border-foreground bg-background"
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Pickup
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {data.warehouse.name}
                </p>
                <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                  {warehouseAddress(data.warehouse) || "Warehouse address missing"}
                </p>
                <p className="mt-1 text-xs">
                  {hasContact ? (
                    <span className="text-muted-foreground tabular-nums">
                      {data.warehouse.phone_number}
                    </span>
                  ) : (
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      Phone number required
                    </span>
                  )}
                </p>
              </div>

              {!locked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditingWarehouse((v) => !v)}
                >
                  {editingWarehouse ? "Close" : "Change"}
                </Button>
              )}
            </div>

            {editingWarehouse && (
              <div className="mt-3.5 rounded-lg border bg-muted/15 p-3.5">
                <PickupWarehouseSelector
                  orderId={data.order.id}
                  warehouse={data.warehouse}
                  locked={locked}
                  busy={busy}
                  saving={saving}
                  feedback={feedback}
                  onSave={onSave}
                />
              </div>
            )}
          </div>

          {/* Drop-off */}
          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute top-1.5 -left-6 size-2.5 rounded-full bg-orange-600"
            />
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Drop-off
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {data.order.shipping_recipient || "Recipient missing"}
            </p>
            <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
              {data.order.shipping_address || "Destination address missing"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ServicePanel({
  cities,
  city,
  service,
  disabled,
  loading,
  error,
  onCity,
  onService,
  retry,
}: {
  cities: City[];
  city: string;
  service: string;
  disabled: boolean;
  loading: boolean;
  error?: string;
  onCity: (value: string) => void;
  onService: (value: string) => void;
  retry: () => void;
}) {
  const services = cities.find((item) => item.locode === city)?.services || [];
  const chosen = services.find((item) => item.key === service);

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold tracking-tight">
          Vehicle service
        </h2>
        {loading && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Loading...
          </span>
        )}
      </div>

      <div className="space-y-4 p-5">
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            <span>{error}</span>
            <Button type="button" variant="outline" size="xs" onClick={retry}>
              Retry
            </Button>
          </div>
        )}

        <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
          <span>Operating city</span>
          <select
            aria-label="Operating city"
            className={selectInputClass}
            value={city}
            disabled={disabled || loading}
            onChange={(event) => onCity(event.target.value)}
          >
            <option value="">Select city</option>
            {cities.map((item) => (
              <option key={item.locode} value={item.locode}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        {city && (
          <div className="space-y-2">
            <span className="block text-xs font-medium text-muted-foreground">
              Select vehicle
            </span>
            {!services.length ? (
              <p className="text-xs text-muted-foreground">
                No high-capacity trucks available for this city.
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-label="Vehicle service"
                className="grid gap-2 sm:grid-cols-2"
              >
                {services.map((item) => {
                  const selected = service === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={disabled}
                      onClick={() => onService(item.key)}
                      className={cn(
                        "flex flex-col items-start rounded-lg border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
                        selected
                          ? "border-foreground bg-muted/50"
                          : "border-border hover:bg-muted/30",
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {words(item.key)}
                        </span>
                        {item.load && (
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {item.load.value} {item.load.unit}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {chosen?.dimensions && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Dimensions</span>
            {Object.entries(chosen.dimensions).map(([key, dim]) => (
              <span key={key} className="capitalize tabular-nums">
                {key}: {dim.value} {dim.unit}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function QuotePanel({
  data,
  quote,
  service,
  now,
  busy,
  quoting,
  booking,
  confirmed,
  onConfirmed,
  onQuote,
  onBook,
}: {
  data: Context;
  quote: Quotation | null;
  service?: City["services"][number];
  now: number;
  busy: boolean;
  quoting: boolean;
  booking: boolean;
  confirmed: boolean;
  onConfirmed: (value: boolean) => void;
  onQuote: () => void;
  onBook: () => void;
}) {
  const seconds = quote
    ? Math.max(0, Math.ceil((Date.parse(quote.expiresAt) - now) / 1000))
    : 0;
  const expired = !!quote && seconds <= 0;
  const isLalamove = data.order.delivery_method === "LALAMOVE";
  const canQuote = data.enabled && data.eligible && !!service && isLalamove;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-5 py-3.5">
        <h2
          tabIndex={-1}
          className="text-sm font-semibold tracking-tight outline-none"
        >
          Quotation
        </h2>
        {quote && (
          <span
            role="timer"
            aria-label="Quotation time remaining"
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
              expired
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
          >
            {expired
              ? "Expired"
              : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
          </span>
        )}
      </div>

      <div className="space-y-4 p-5">
        {!data.enabled && (
          <p
            role="status"
            className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground"
          >
            New bookings are disabled. Existing bookings can still be tracked.
          </p>
        )}

        {!isLalamove ? (
          <div className="py-4 text-center">
            <p className="text-sm font-medium">Set delivery method to Lalamove</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose Lalamove in the Route panel, then select a city and vehicle.
            </p>
          </div>
        ) : (
          <>
            {!data.eligible && data.reason && (
              <div
                role="status"
                className="relative overflow-hidden rounded-lg border border-amber-500/45 bg-amber-500/[0.09] px-3.5 py-2.5 pl-4 text-xs text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/[0.12] dark:text-amber-200"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-1 bg-amber-500"
                />
                {data.reason}
              </div>
            )}

            {quote ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {words(quote.serviceType)}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                    {money(
                      quote.priceBreakdown.total,
                      quote.priceBreakdown.currency,
                    )}
                  </p>
                </div>

                <details className="group border-y py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground">
                    <span>Fee breakdown</span>
                    <ChevronDown
                      className="size-3.5 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <dl className="mt-2.5 space-y-1.5">
                    {Object.entries(quote.priceBreakdown)
                      .filter(([key]) => !["total", "currency"].includes(key))
                      .map(([key, value]) => (
                        <div
                          key={key}
                          className="flex justify-between gap-4 text-xs"
                        >
                          <dt className="text-muted-foreground">
                            {words(key)}
                          </dt>
                          <dd className="tabular-nums">
                            {money(value, quote.priceBreakdown.currency)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </details>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-xs">
                  <input
                    className="mt-0.5 size-4 shrink-0 accent-orange-600"
                    type="checkbox"
                    checked={confirmed}
                    disabled={busy || expired}
                    onChange={(event) => onConfirmed(event.target.checked)}
                  />
                  <span className="leading-relaxed">
                    <span className="font-medium text-foreground">
                      Package fits selected vehicle
                    </span>
                    <span className="block text-muted-foreground">
                      Dimensions and weight verified.
                    </span>
                  </span>
                </label>

                <div className="space-y-2">
                  <Button
                    type="button"
                    className={cn("h-10 w-full", primaryCtaClass)}
                    disabled={
                      busy ||
                      expired ||
                      !confirmed ||
                      !data.enabled ||
                      !data.eligible
                    }
                    onClick={onBook}
                  >
                    {booking ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ArrowRight className="size-4" aria-hidden="true" />
                    )}
                    {booking ? "Confirming..." : "Confirm booking"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={busy || !canQuote}
                    onClick={onQuote}
                  >
                    {quoting ? "Getting quote..." : "Refresh quote"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {service
                    ? `Ready to quote ${words(service.key)}.`
                    : "Select a city and vehicle to check the courier fee."}
                </p>
                <Button
                  type="button"
                  className={cn("h-10 w-full", primaryCtaClass)}
                  disabled={busy || !canQuote}
                  onClick={onQuote}
                >
                  {quoting && (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {quoting ? "Getting quote..." : "Get quotation"}
                </Button>
              </div>
            )}
          </>
        )}

        <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
          Company pays courier fee. No booking is created until you confirm.
        </p>
      </div>
    </section>
  );
}
