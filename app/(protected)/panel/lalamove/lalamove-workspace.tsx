"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ChevronDown, RefreshCw, Route, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "./lib/api";
import { BookingCard } from "./components/booking-card";
import { LalamoveLiveMap } from "./components/lalamove-live-map";
import { MultiStopBookingView } from "./components/multi-stop-booking-view";
import { MultiStopBuilder } from "./components/multi-stop-builder";
import {
  DeliveryDetails,
  QuotePanel,
  ServicePanel,
} from "./components/order-panels";
import { Overview } from "./components/overview";
import { dateLabel, primaryCtaClass, QueryError, words } from "./components/shared";
import type { PickupFeedback } from "./components/pickup-warehouse-selector";
import type {
  Booking,
  BookingContext,
  City,
  Context,
  Quotation,
  ReadyOrder,
  Reconciliation,
  Setup,
} from "./types";

const BASE_PATH = "/panel/lalamove";
const MANILA_NCR_LOCODE = "PH MNL";
const MIN_TRUCK_LOAD_KG = 2000;

function selectTruckCities({ data }: { data: City[] }) {
  return data.map((city) => ({
    ...city,
    services: city.services.filter(({ load }) => {
      if (load?.unit.trim().toLowerCase() !== "kg") return false;
      const capacity = Number(load.value);
      return Number.isFinite(capacity) && capacity >= MIN_TRUCK_LOAD_KG;
    }),
  }));
}

export function LalamoveWorkspace() {
  const params = useSearchParams();
  const orderParam = Number(params.get("orderId"));
  const bookingParam = Number(params.get("bookingId"));
  const orderId = Number.isSafeInteger(orderParam) && orderParam > 0 ? orderParam : 0;
  const bookingId =
    !orderId && Number.isSafeInteger(bookingParam) && bookingParam > 0
      ? bookingParam
      : 0;
  const isMultiStopBuilder =
    !orderId && !bookingId && params.get("mode") === "multi-stop";

  const workspaceKey = orderId
    ? `order-${orderId}`
    : bookingId
      ? `booking-${bookingId}`
      : isMultiStopBuilder
        ? "multi-stop"
        : "overview";

  return (
    <Workspace
      key={workspaceKey}
      orderId={orderId}
      bookingId={bookingId}
      isMultiStopBuilder={isMultiStopBuilder}
    />
  );
}

function Workspace({
  orderId,
  bookingId,
  isMultiStopBuilder,
}: {
  orderId: number;
  bookingId: number;
  isMultiStopBuilder: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();

  const isOverview = !orderId && !bookingId && !isMultiStopBuilder;
  const view = params.get("view") === "history" ? "history" : "overview";
  const filter = ["active", "review", "completed"].includes(
    params.get("filter") || "",
  )
    ? params.get("filter") || "all"
    : "all";
  const search = (params.get("q") || "").trim();
  const pageValue = Number(params.get("page"));
  const historyPage =
    Number.isSafeInteger(pageValue) && pageValue >= 0 && pageValue <= 10000
      ? pageValue
      : 0;

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickupSaving, setPickupSaving] = useState(false);
  const [pickupFeedback, setPickupFeedback] = useState<PickupFeedback>(null);
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);
  const [selectedCity, setCity] = useState<string>();
  const [service, setService] = useState("");
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [packageConfirmed, setPackageConfirmed] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  const confirmation = useRef<{ quote: string; key: string } | null>(null);
  const quotePanel = useRef<HTMLElement>(null);

  const context = useQuery({
    queryKey: ["lalamove", "context", orderId],
    queryFn: () => api<Context>("GET", `/context/${orderId}`),
    enabled: orderId > 0,
    refetchInterval: 15000,
  });
  const bookingDetail = useQuery({
    queryKey: ["lalamove", "booking-context", bookingId],
    queryFn: () => api<BookingContext>("GET", `/bookings/${bookingId}`),
    enabled: bookingId > 0,
    refetchInterval: 15000,
  });
  const eligible = useQuery({
    queryKey: ["lalamove", "eligible"],
    queryFn: () => api<ReadyOrder[]>("GET", "/eligible"),
    enabled: isOverview || isMultiStopBuilder,
  });
  const bookings = useQuery({
    queryKey: ["lalamove", "history", historyPage],
    queryFn: () => api<Booking[]>("GET", `/orders?page=${historyPage}`),
    enabled: isOverview,
    refetchInterval: 30000,
  });
  const queue = useQuery({
    queryKey: ["lalamove", "reconciliation"],
    queryFn: () => api<Reconciliation>("GET", "/reconciliation"),
    enabled: isOverview,
    refetchInterval: 60000,
  });
  const setup = useQuery({
    queryKey: ["lalamove", "setup"],
    queryFn: () => api<Setup>("GET", "/setup"),
    enabled: isOverview || isMultiStopBuilder,
    refetchInterval: 30000,
  });
  const cities = useQuery({
    queryKey: ["lalamove", "cities"],
    queryFn: () => api<{ data: City[] }>("GET", "/cities"),
    select: selectTruckCities,
    enabled: Boolean(
      (orderId > 0 && context.data?.enabled) ||
        (isMultiStopBuilder && setup.data?.enabled),
    ),
    staleTime: 300000,
  });

  useEffect(() => {
    if (!orderId && !bookingId) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [orderId, bookingId]);

  const data = context.data;
  const active = data?.bookings.some((attempt) => attempt.active) || false;
  const primaryBooking =
    data?.bookings.find((attempt) => attempt.active) ||
    data?.bookings.find((attempt) => attempt.status === "COMPLETED") ||
    null;
  const previousAttempts =
    data?.bookings.filter((attempt) => attempt.id !== primaryBooking?.id) || [];
  const cityOptions = cities.data ?? [];
  const defaultCity =
    cityOptions.find((item) => item.locode === MANILA_NCR_LOCODE)?.locode ?? "";
  const city = selectedCity ?? defaultCity;
  const chosenService = cityOptions
    .find((item) => item.locode === city)
    ?.services.find((item) => item.key === service);
  const environment =
    data?.environment ||
    bookingDetail.data?.environment ||
    setup.data?.environment;
  const updatedAt = orderId
    ? context.dataUpdatedAt
    : bookingId
      ? bookingDetail.dataUpdatedAt
      : isMultiStopBuilder
        ? eligible.dataUpdatedAt
        : Math.max(eligible.dataUpdatedAt, bookings.dataUpdatedAt);
  const step = primaryBooking ? 2 : quote ? 1 : 0;

  function updateUrl(values: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, val] of Object.entries(values)) {
      if (val === null || val === "") next.delete(key);
      else next.set(key, val);
    }
    router.replace(`${BASE_PATH}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  }

  function viewHref(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "overview") next.delete("view");
    else next.set("view", value);
    return `${BASE_PATH}${next.size ? `?${next}` : ""}`;
  }

  async function action(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await Promise.all([
        client.invalidateQueries({ queryKey: ["lalamove"] }),
        client.invalidateQueries({ queryKey: ["order"] }),
      ]);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to complete operation.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  function invalidateQuote() {
    setQuote(null);
    setPackageConfirmed(false);
    confirmation.current = null;
  }

  async function savePickupWarehouse(warehouseId: number) {
    if (!data) return;
    setBusy(true);
    setPickupSaving(true);
    setPickupFeedback(null);
    try {
      const result = await api<{ message: string }>(
        "PUT",
        `/context/${orderId}/warehouse`,
        {
          warehouse_id: warehouseId,
          version: data.order.version,
        },
      );
      invalidateQuote();
      setPickupFeedback({
        kind: "success",
        message: result.message || "Pickup warehouse saved.",
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["lalamove"] }),
        client.invalidateQueries({ queryKey: ["warehouses"] }),
        client.invalidateQueries({ queryKey: ["warehouse_detail"] }),
      ]);
    } catch (cause) {
      setPickupFeedback({
        kind: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "Unable to save pickup warehouse.",
      });
    } finally {
      setPickupSaving(false);
      setBusy(false);
    }
  }

  async function requestQuotation() {
    if (!data || !chosenService) return;
    setQuoting(true);
    try {
      const success = await action(async () => {
        invalidateQuote();
        setQuote(
          await api<Quotation>("POST", "/quotations", {
            order_id: orderId,
            order_version: data.order.version,
            service_type: chosenService.key,
            city,
          }),
        );
      });
      if (success) {
        requestAnimationFrame(() => {
          quotePanel.current?.querySelector("h2")?.focus({ preventScroll: true });
          if (window.matchMedia("(max-width: 1023px)").matches) {
            quotePanel.current?.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
              block: "start",
            });
          }
        });
      }
    } finally {
      setQuoting(false);
    }
  }

  async function confirmBooking() {
    if (!data || !quote) return;
    let operation = confirmation.current;
    if (operation?.quote !== quote.quotation_ref) {
      operation = { quote: quote.quotation_ref, key: crypto.randomUUID() };
      confirmation.current = operation;
    }
    const key = operation.key;
    setBooking(true);
    try {
      await action(async () => {
        await api("POST", "/orders", {
          order_id: orderId,
          order_version: data.order.version,
          quotation_ref: quote.quotation_ref,
          idempotency_key: key,
          package_confirmed: packageConfirmed,
        });
        setQuote(null);
      });
      // Reload durable attempt even if browser response was uncertain.
      await context.refetch();
    } finally {
      setBooking(false);
    }
  }

  const isRefreshing = orderId
    ? context.isFetching
    : bookingId
      ? bookingDetail.isFetching
      : isMultiStopBuilder
        ? eligible.isFetching
        : bookings.isFetching || eligible.isFetching;

  const navItems = [
    { value: "overview", label: "Overview" },
    { value: "history", label: "History" },
  ];

  const pageTitle = orderId
    ? data?.order.order_number || "Order booking"
    : bookingId
      ? `Multi-stop booking #${bookingId}`
      : isMultiStopBuilder
        ? "Multi-stop Lalamove booking"
        : "Lalamove";

  return (
    <main className="min-w-0 px-4 py-5 md:px-6 lg:px-8 lg:py-7">
      <div className="space-y-5">
        {/* Clean Header */}
        <header className="space-y-4">
          {!isOverview && (
            <Link
              href={BASE_PATH}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Lalamove
            </Link>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {pageTitle}
              </h1>
              {environment && (
                <span className="rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                  {environment}
                </span>
              )}
              {updatedAt > 0 && (
                <span className="text-xs text-muted-foreground">
                  Updated {dateLabel(new Date(updatedAt).toISOString())}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isOverview && (
                <Button
                  size="sm"
                  className={primaryCtaClass}
                  nativeButton={false}
                  render={<Link href={`${BASE_PATH}?mode=multi-stop`} />}
                >
                  <Route className="size-3.5" aria-hidden="true" />
                  New multi-stop booking
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRefreshing}
                onClick={() => {
                  if (orderId) {
                    void context.refetch();
                  } else if (bookingId) {
                    void bookingDetail.refetch();
                  } else if (isMultiStopBuilder) {
                    void eligible.refetch();
                  } else {
                    void bookings.refetch();
                    void eligible.refetch();
                  }
                }}
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn(
                    "size-3.5",
                    isRefreshing && "animate-spin motion-reduce:animate-none",
                  )}
                />
                {isRefreshing ? "Refreshing" : "Refresh"}
              </Button>
            </div>
          </div>

          {isOverview && (
            <nav
              aria-label="Lalamove sections"
              className="flex items-center gap-1 border-b"
            >
              {navItems.map((item) => {
                const activeTab = view === item.value;
                return (
                  <Link
                    key={item.value}
                    href={viewHref(item.value)}
                    aria-current={activeTab ? "page" : undefined}
                    className={cn(
                      "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                      activeTab
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {orderId > 0 && data && (
            <ol
              aria-label="Booking progress"
              className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b pb-3.5 text-xs"
            >
              {["1. Route & vehicle", "2. Quotation", "3. Booked"].map(
                (label, idx) => (
                  <li
                    key={label}
                    aria-current={step === idx ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2",
                      idx === step
                        ? "font-semibold text-foreground"
                        : idx < step
                          ? "text-foreground/75"
                          : "text-muted-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        idx < step
                          ? "bg-emerald-500"
                          : idx === step
                            ? "bg-orange-600"
                            : "bg-border",
                      )}
                    />
                    {label}
                  </li>
                ),
              )}
            </ol>
          )}
        </header>

        {/* Global Error / Notice */}
        {error && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <span>{error}</span>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setError(null)}
              className="rounded p-0.5 hover:bg-destructive/10"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
          >
            <span>{notice}</span>
            <button
              type="button"
              aria-label="Dismiss notice"
              onClick={() => setNotice(null)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Main Content */}
        {isMultiStopBuilder ? (
          <MultiStopBuilder
            enabled={Boolean(setup.data?.enabled)}
            busy={busy}
            readyOrders={eligible.data ?? []}
            readyPending={eligible.isPending}
            readyError={eligible.error?.message}
            retryReady={() => void eligible.refetch()}
            cities={cityOptions}
            defaultCity={defaultCity}
            citiesLoading={cities.isFetching && !cities.data}
            citiesError={cities.error?.message}
            retryCities={() => void cities.refetch()}
            action={action}
            onBooked={(newId) => {
              setNotice("Multi-stop Lalamove booking created.");
              router.replace(`${BASE_PATH}?bookingId=${newId}`);
            }}
          />
        ) : bookingId > 0 ? (
          <>
            {bookingDetail.error && (
              <QueryError
                message={bookingDetail.error.message}
                retry={() => void bookingDetail.refetch()}
              />
            )}
            {bookingDetail.isPending ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                <Skeleton className="h-72 w-full rounded-xl motion-reduce:animate-none" />
                <Skeleton className="h-72 w-full rounded-xl motion-reduce:animate-none" />
              </div>
            ) : (
              bookingDetail.data && (
                <MultiStopBookingView
                  data={bookingDetail.data}
                  busy={busy}
                  action={action}
                  now={clock}
                />
              )
            )}
          </>
        ) : isOverview ? (
          <Overview
            view={view}
            filter={filter}
            search={search}
            page={historyPage}
            busy={busy}
            ready={eligible}
            bookings={bookings}
            queue={queue}
            action={action}
            updateUrl={updateUrl}
          />
        ) : (
          <>
            {context.error && (
              <QueryError
                message={context.error.message}
                retry={() => void context.refetch()}
              />
            )}

            {context.isPending ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                <Skeleton className="h-72 w-full rounded-xl motion-reduce:animate-none" />
                <Skeleton className="h-72 w-full rounded-xl motion-reduce:animate-none" />
              </div>
            ) : (
              data && (
                <div className="space-y-5">
                  {primaryBooking && (primaryBooking.stop_count ?? 1) > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/30 bg-orange-500/[0.06] px-4 py-3 text-xs">
                      <span className="font-medium text-foreground">
                        This order is part of a {primaryBooking.stop_count}-stop
                        Lalamove run (Booking #{primaryBooking.id}).
                      </span>
                      <Link
                        href={`${BASE_PATH}?bookingId=${primaryBooking.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-orange-700 underline-offset-4 hover:underline dark:text-orange-400"
                      >
                        View all {primaryBooking.stop_count} stops
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  )}

                  <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="min-w-0 space-y-5">
                      {primaryBooking && (
                        <LalamoveLiveMap
                          booking={primaryBooking}
                          warehouse={data.warehouse}
                          fallbackDropoff={{
                            orderNumber: data.order.order_number,
                            recipient: data.order.shipping_recipient,
                            address: data.order.shipping_address,
                            lat: data.order.shipping_latitude,
                            lng: data.order.shipping_longitude,
                          }}
                        />
                      )}

                      <DeliveryDetails
                        key={data.warehouse.id}
                        data={data}
                        busy={busy}
                        saving={pickupSaving}
                        feedback={pickupFeedback}
                        onSave={(id) => void savePickupWarehouse(id)}
                        onMethod={(method) =>
                          void action(async () => {
                            await api("PUT", `/context/${orderId}/method`, {
                              version: data.order.version,
                              method,
                            });
                            invalidateQuote();
                          })
                        }
                      />

                      {!active &&
                        data.order.delivery_method === "LALAMOVE" &&
                        !primaryBooking && (
                          <ServicePanel
                            cities={cityOptions}
                            city={city}
                            service={service}
                            disabled={busy || !data.enabled}
                            loading={cities.isFetching && !cities.data}
                            error={cities.error?.message}
                            onCity={(val) => {
                              setCity(val);
                              setService("");
                              invalidateQuote();
                            }}
                            onService={(val) => {
                              setService(val);
                              invalidateQuote();
                            }}
                            retry={() => void cities.refetch()}
                          />
                        )}
                    </div>

                    <aside
                      ref={quotePanel}
                      aria-label={
                        primaryBooking ? "Courier booking" : "Quotation"
                      }
                      className="min-w-0 scroll-mt-4 lg:sticky lg:top-6"
                    >
                      {primaryBooking ? (
                        <BookingCard
                          booking={primaryBooking}
                          busy={busy}
                          action={action}
                          canReconcile={data.can_reconcile}
                          now={clock}
                        />
                      ) : (
                        <QuotePanel
                          data={data}
                          quote={quote}
                          service={chosenService}
                          now={clock}
                          busy={busy}
                          quoting={quoting}
                          booking={booking}
                          confirmed={packageConfirmed}
                          onConfirmed={setPackageConfirmed}
                          onQuote={() => void requestQuotation()}
                          onBook={() => void confirmBooking()}
                        />
                      )}
                    </aside>
                  </div>

                  {/* Previous booking attempts */}
                  {!!previousAttempts.length && (
                    <details className="group rounded-xl border bg-card">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-medium">
                        <span>
                          Previous attempts{" "}
                          <span className="text-muted-foreground tabular-nums">
                            ({previousAttempts.length})
                          </span>
                        </span>
                        <ChevronDown
                          className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        />
                      </summary>
                      <div className="grid gap-4 border-t p-5 md:grid-cols-2 xl:grid-cols-3">
                        {previousAttempts.map((attempt) => (
                          <BookingCard
                            key={attempt.id}
                            booking={attempt}
                            busy={busy}
                            action={action}
                            canReconcile={data.can_reconcile}
                            now={clock}
                          />
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Activity log */}
                  {!!data.history.length && (
                    <section className="overflow-hidden rounded-xl border bg-card">
                      <div className="flex items-center justify-between border-b px-5 py-3.5">
                        <h2 className="text-sm font-semibold tracking-tight">
                          Activity
                        </h2>
                        <span className="text-xs text-muted-foreground">
                          Manila time
                        </span>
                      </div>
                      <ol className="divide-y px-5">
                        {data.history.map((event) => (
                          <li
                            key={event.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {event.event_type === "HYOPS_PROVIDER_SYNC"
                                  ? "Delivery details updated"
                                  : words(event.event_type)}
                              </p>
                              {event.last_error && (
                                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                                  {event.last_error}
                                </p>
                              )}
                            </div>
                            <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {dateLabel(event.created_at)} ·{" "}
                              {words(event.state)}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                </div>
              )
            )}
          </>
        )}
      </div>
    </main>
  );
}
