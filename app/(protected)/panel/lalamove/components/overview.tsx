"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  Action,
  Booking,
  ReadyOrder,
  Reconciliation,
  Setup,
} from "../types";
import { api } from "../lib/api";
import {
  bookingStatus,
  dateLabel,
  EmptyBlock,
  money,
  QueryError,
  RowsSkeleton,
  StatusPill,
} from "./shared";

type Query<T> = Pick<
  UseQueryResult<T, Error>,
  "data" | "error" | "isPending" | "isFetching" | "refetch"
>;

type Props = {
  view: string;
  filter: string;
  search: string;
  page: number;
  busy: boolean;
  ready: Query<ReadyOrder[]>;
  bookings: Query<Booking[]>;
  setup: Query<Setup>;
  queue: Query<Reconciliation>;
  action: Action;
  setNotice: (message: string) => void;
  updateUrl: (values: Record<string, string | null>) => void;
};

export function Overview({
  view,
  filter,
  search,
  page,
  busy,
  ready,
  bookings,
  setup,
  queue,
  action,
  setNotice,
  updateUrl,
}: Props) {
  const [readyLimit, setReadyLimit] = useState(8);
  const [draftSearch, setDraftSearch] = useState(search);

  const records = bookings.data || [];
  const activeCount = records.filter((b) => b.active).length;
  const reviewCount = records.filter((b) =>
    ["UNKNOWN", "REVIEW"].includes(b.booking_state),
  ).length;

  const queryTerm = draftSearch.trim().toLowerCase();

  const matchingReady = (ready.data || []).filter((order) =>
    `${order.order_number} ${order.shipping_address || ""}`
      .toLowerCase()
      .includes(queryTerm),
  );

  const matchingBookings = records.filter((booking) => {
    const matchesSearch =
      `${booking.order_number || booking.order_id} ${booking.lalamove_order_id || ""} ${booking.dropoff_address || ""} ${booking.recipient_name || ""}`
        .toLowerCase()
        .includes(queryTerm);
    const review = ["UNKNOWN", "REVIEW"].includes(booking.booking_state);
    return (
      matchesSearch &&
      (filter === "active"
        ? booking.active
        : filter === "review"
          ? review
          : filter === "completed"
            ? booking.status === "COMPLETED" || !!booking.completed_at
            : true)
    );
  });

  if (view === "settings") {
    return (
      <div className="max-w-2xl space-y-5">
        {setup.isPending ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <RowsSkeleton rows={2} label="settings" />
          </div>
        ) : setup.error ? (
          <QueryError
            message={setup.error.message}
            retry={() => void setup.refetch()}
          />
        ) : !setup.data?.can_manage ? (
          <div className="rounded-xl border bg-card">
            <EmptyBlock
              title="Administrator access required"
              description="Only administrators can manage Lalamove connection settings."
            />
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-3.5">
                <h2 className="text-sm font-semibold tracking-tight">
                  Connection
                </h2>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                  {setup.data.environment}
                </span>
              </div>
              <div className="divide-y px-5">
                <div className="flex items-center justify-between py-3.5 text-sm">
                  <span className="text-muted-foreground">New bookings</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium",
                      setup.data.enabled
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-muted-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        setup.data.enabled
                          ? "bg-emerald-500"
                          : "bg-muted-foreground",
                      )}
                    />
                    {setup.data.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="py-3.5 text-xs leading-relaxed text-muted-foreground">
                  Automatic polling updates deliveries every 2–3 minutes. Use{" "}
                  <span className="font-medium text-foreground">
                    Refresh status
                  </span>{" "}
                  on any booking for an immediate check.
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b px-5 py-3.5">
                <h2 className="text-sm font-semibold tracking-tight">
                  Webhook
                </h2>
              </div>
              <div className="space-y-4 p-5">
                <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
                  <span>Callback URL</span>
                  <Input
                    aria-label="Public callback URL"
                    readOnly
                    value={setup.data.callback_url || ""}
                    placeholder="Not configured"
                    className="h-9 font-mono text-xs"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Last callback:{" "}
                    {setup.data.last_callback_at
                      ? `${dateLabel(setup.data.last_callback_at)} · Manila`
                      : "None yet"}
                  </span>
                  <span>Use v3 in Partner Portal</span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || !setup.data.callback_url}
                  onClick={() =>
                    void action(async () => {
                      const result = await api<{ message: string }>(
                        "POST",
                        "/webhook/register",
                      );
                      setNotice(result.message);
                    })
                  }
                >
                  <RefreshCw
                    className={cn("size-3.5", busy && "animate-spin")}
                    aria-hidden="true"
                  />
                  Register {setup.data.environment} webhook
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top summary strip — Needs review stands out clearly when > 0 */}
      <section
        aria-label="Lalamove summary"
        className="grid gap-3 sm:grid-cols-3"
      >
        <div className="rounded-xl border bg-card px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">
            Ready to book
          </p>
          {ready.isPending ? (
            <Skeleton className="mt-2 h-7 w-12 motion-reduce:animate-none" />
          ) : (
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
              {ready.error ? "—" : (ready.data?.length ?? 0).toLocaleString()}
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-card px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">
            Active bookings
          </p>
          {bookings.isPending ? (
            <Skeleton className="mt-2 h-7 w-12 motion-reduce:animate-none" />
          ) : (
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
              {bookings.error ? "—" : activeCount.toLocaleString()}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            updateUrl({ filter: reviewCount > 0 ? "review" : null })
          }
          className={cn(
            "group relative flex items-center justify-between overflow-hidden rounded-xl border px-5 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            reviewCount > 0
              ? "border-amber-500/50 bg-amber-500/[0.09] hover:bg-amber-500/[0.14] dark:border-amber-500/40 dark:bg-amber-500/[0.12] dark:hover:bg-amber-500/[0.18]"
              : "border-border bg-card hover:bg-muted/35",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-0 left-0 w-1",
              reviewCount > 0 ? "bg-amber-500" : "bg-transparent",
            )}
          />
          <div className="pl-0.5">
            <p
              className={cn(
                "text-xs font-medium",
                reviewCount > 0
                  ? "text-amber-950 dark:text-amber-200"
                  : "text-muted-foreground",
              )}
            >
              Needs review
            </p>
            {bookings.isPending ? (
              <Skeleton className="mt-2 h-7 w-12 motion-reduce:animate-none" />
            ) : (
              <p
                className={cn(
                  "mt-1.5 text-2xl font-semibold tracking-tight tabular-nums",
                  reviewCount > 0
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-muted-foreground/60",
                )}
              >
                {bookings.error ? "—" : reviewCount.toLocaleString()}
              </p>
            )}
          </div>
          {reviewCount > 0 && (
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Filter →
            </span>
          )}
        </button>
      </section>

      {/* Reconciliation queue alert */}
      {!!queue.data?.events?.length && queue.data.can_reconcile && (
        <section className="relative overflow-hidden rounded-xl border border-amber-500/45 bg-amber-500/[0.08] px-5 py-4 pl-6 dark:border-amber-500/35 dark:bg-amber-500/[0.11]">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1 bg-amber-500"
          />
          <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-200">
            Sync updates need attention ({queue.data.events.length})
          </h2>
          <div className="mt-2.5 divide-y divide-amber-500/20">
            {queue.data.events.map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {event.provider_order_id
                      ? `Ref ${event.provider_order_id}`
                      : "Account update"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.last_error || "Pending reconciliation"} ·{" "}
                    {event.attempts} attempts
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={busy}
                  onClick={() =>
                    void action(() =>
                      api("POST", `/events/${event.id}/reconcile`),
                    )
                  }
                >
                  Retry sync
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {queue.error && (
        <QueryError
          message="Reconciliation updates unavailable."
          retry={() => void queue.refetch()}
        />
      )}

      {/* Compact search input */}
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          aria-label="Search order or destination"
          value={draftSearch}
          onChange={(e) => {
            const next = e.target.value;
            setDraftSearch(next);
            updateUrl({ q: next.trim() || null });
          }}
          placeholder="Search order, ref, or address..."
          className="h-9 bg-card pr-8 pl-8 text-sm"
        />
        {draftSearch && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setDraftSearch("");
              updateUrl({ q: null });
            }}
            className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Ready orders list */}
      {view !== "history" && (
        <section
          aria-label="Ready to book"
          className="overflow-hidden rounded-xl border bg-card"
        >
          <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                Ready to book
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {matchingReady.length}
              </span>
            </div>
            <Link
              href="/panel/orders"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              All orders →
            </Link>
          </div>

          {ready.isPending ? (
            <RowsSkeleton rows={3} label="ready orders" />
          ) : ready.error ? (
            <div className="p-4">
              <QueryError
                message={ready.error.message}
                retry={() => void ready.refetch()}
              />
            </div>
          ) : !matchingReady.length ? (
            <EmptyBlock
              title={queryTerm ? "No matching ready orders" : "No orders ready"}
              description={
                queryTerm
                  ? "Try a different order number or address."
                  : "Orders in Scheduling appear here when ready for courier dispatch."
              }
              action={
                queryTerm ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDraftSearch("");
                      updateUrl({ q: null });
                    }}
                  >
                    Clear search
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/panel/orders" />}
                  >
                    Open orders
                  </Button>
                )
              }
            />
          ) : (
            <>
              <ul className="divide-y">
                {matchingReady.slice(0, readyLimit).map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/25"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {order.order_number}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {order.shipping_address || "Destination address missing"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={
                        <Link href={`/panel/lalamove?orderId=${order.id}`} />
                      }
                    >
                      Review
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>

              {matchingReady.length > readyLimit && (
                <div className="border-t px-5 py-2.5">
                  <button
                    type="button"
                    onClick={() => setReadyLimit((n) => n + 8)}
                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Show more ({matchingReady.length - readyLimit} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Bookings history table */}
      <section
        aria-label="Booking history"
        className="overflow-hidden rounded-xl border bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Bookings</h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              Page {page + 1}
            </span>
          </div>

          <div
            role="group"
            aria-label="Filter bookings"
            className="inline-flex flex-wrap rounded-lg bg-muted p-0.5"
          >
            {[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "review", label: "Needs review" },
              { value: "completed", label: "Delivered" },
            ].map((item) => {
              const active = filter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    updateUrl({
                      filter: item.value === "all" ? null : item.value,
                    })
                  }
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
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

        {bookings.isPending ? (
          <RowsSkeleton rows={4} label="bookings" />
        ) : bookings.error ? (
          <div className="p-4">
            <QueryError
              message={bookings.error.message}
              retry={() => void bookings.refetch()}
            />
          </div>
        ) : !matchingBookings.length ? (
          <EmptyBlock
            title={
              queryTerm || filter !== "all"
                ? "No matching bookings"
                : "No bookings yet"
            }
            description={
              queryTerm || filter !== "all"
                ? "Clear filters or check another page."
                : "Confirmed bookings will appear here."
            }
            action={
              queryTerm || filter !== "all" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraftSearch("");
                    updateUrl({ q: null, filter: null });
                  }}
                >
                  Reset filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_1fr_1fr_110px_64px] gap-4 border-b bg-muted/30 px-5 py-2.5 text-xs font-medium text-muted-foreground md:grid">
              <span>Order</span>
              <span>Status</span>
              <span>Synced</span>
              <span className="text-right">Fee</span>
              <span className="sr-only">Open</span>
            </div>

            <ul className="divide-y">
              {matchingBookings.map((booking) => {
                const needsReview = ["UNKNOWN", "REVIEW"].includes(
                  booking.booking_state,
                );
                return (
                  <li
                    key={booking.id}
                    className={cn(
                      "relative grid items-center gap-2.5 px-5 py-3.5 transition-colors hover:bg-muted/25 md:grid-cols-[minmax(0,1.4fr)_1fr_1fr_110px_64px] md:gap-4",
                      needsReview && "bg-amber-500/[0.04]",
                    )}
                  >
                    {needsReview && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-1 bg-amber-500"
                      />
                    )}
                    <div className="min-w-0">
                      <Link
                        href={`/panel/lalamove?orderId=${booking.order_id}`}
                        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {booking.order_number || `Order #${booking.order_id}`}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {booking.lalamove_order_id || `Attempt #${booking.id}`}{" "}
                        · {booking.environment}
                      </p>
                    </div>

                    <div>
                      <StatusPill booking={booking} />
                      <span className="sr-only">
                        {bookingStatus(booking).label}
                      </span>
                    </div>

                    <p className="text-xs tabular-nums text-muted-foreground">
                      {dateLabel(booking.last_synced_at)}
                    </p>

                    <p className="text-sm font-medium tabular-nums md:text-right">
                      {money(booking.delivery_fee, booking.currency)}
                    </p>

                    <div className="md:text-right">
                      <Link
                        href={`/panel/lalamove?orderId=${booking.order_id}`}
                        aria-label={`View ${booking.order_number || booking.order_id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Open
                        <ArrowRight className="size-3" aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
              <p className="text-xs tabular-nums text-muted-foreground">
                {matchingBookings.length} shown
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={!page || bookings.isFetching}
                  onClick={() =>
                    updateUrl({ page: page > 1 ? String(page - 1) : null })
                  }
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={records.length < 50 || bookings.isFetching}
                  onClick={() => updateUrl({ page: String(page + 1) })}
                >
                  Next
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
