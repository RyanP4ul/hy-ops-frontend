"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Action, Booking } from "../types";
import { api } from "../lib/api";
import {
  dateLabel,
  money,
  primaryCtaClass,
  StatusPill,
  words,
} from "./shared";

function ProgressTrack({ booking }: { booking: Booking }) {
  const stepIndex =
    booking.completed_at || booking.status === "COMPLETED"
      ? 3
      : booking.picked_up_at || booking.status === "PICKED_UP"
        ? 2
        : booking.status === "ON_GOING"
          ? 1
          : 0;

  const confirmed =
    !!booking.lalamove_order_id &&
    !["CREATING", "UNKNOWN", "FAILED"].includes(booking.booking_state);

  const steps = ["Matching", "Assigned", "Picked up", "Delivered"];

  return (
    <ol aria-label="Delivery progress" className="grid grid-cols-4 gap-2">
      {steps.map((label, idx) => {
        const done = confirmed && idx < stepIndex;
        const current = confirmed && idx === stepIndex;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className="space-y-1.5"
          >
            <div
              aria-hidden="true"
              className={cn(
                "h-1.5 w-full rounded-full transition-colors",
                done
                  ? "bg-emerald-500"
                  : current
                    ? "bg-orange-600"
                    : "bg-muted",
              )}
            />
            <span
              className={cn(
                "block truncate text-[11px]",
                current
                  ? "font-semibold text-foreground"
                  : done
                    ? "text-foreground/80"
                    : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function BookingCard({
  booking,
  busy,
  action,
  canReconcile,
  now,
}: {
  booking: Booking;
  busy: boolean;
  action: Action;
  canReconcile: boolean;
  now: number;
}) {
  const [note, setNote] = useState("");
  const [providerId, setProviderId] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const needsReview = ["UNKNOWN", "REVIEW"].includes(booking.booking_state);
  const stale =
    !!booking.last_synced_at &&
    now - Date.parse(booking.last_synced_at) > 300_000 &&
    booking.active;
  const canCancel =
    booking.active && !booking.picked_up_at && !!booking.lalamove_order_id;

  async function perform(kind: string, work: () => Promise<unknown>) {
    setPending(kind);
    try {
      if (await action(work)) setConfirmCancel(false);
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        needsReview && "border-amber-500/50",
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">
            {booking.active ? "Active booking" : "Booking"} #{booking.id}
          </h2>
          {(booking.stop_count ?? 1) > 1 && (
            <span className="rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-orange-700 dark:text-orange-400">
              {booking.stop_count} stops
            </span>
          )}
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] capitalize text-muted-foreground">
            {booking.environment}
          </span>
        </div>
        <StatusPill booking={booking} />
      </div>

      <div className="space-y-5 p-5">
        <ProgressTrack booking={booking} />

        {/* Noticeable alert if review needed or failed */}
        {(booking.failure_message || needsReview) && (
          <div
            role="status"
            className="relative overflow-hidden rounded-lg border border-amber-500/45 bg-amber-500/[0.09] px-3.5 py-3 pl-4 text-xs leading-relaxed text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/[0.12] dark:text-amber-200"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1 bg-amber-500"
            />
            <p className="font-semibold">
              {needsReview ? "Review before booking again" : "Booking update"}
            </p>
            <p className="mt-0.5">
              {booking.failure_message ||
                "Courier confirmation needs to be checked by an administrator."}
            </p>
          </div>
        )}

        {/* Cost */}
        <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Courier fee</p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
              {money(booking.delivery_fee, booking.currency)}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">Company pays</span>
        </div>

        {/* Driver */}
        <div className="space-y-2 border-t pt-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Driver</span>
            <span className="font-medium text-foreground">
              {booking.driver_details?.name ||
                (booking.active ? "Waiting for driver" : "—")}
            </span>
          </div>
          {booking.driver_details?.phone && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Phone</span>
              <span className="tabular-nums text-foreground">
                {booking.driver_details.phone}
              </span>
            </div>
          )}
          {booking.driver_details?.plateNumber && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Plate</span>
              <span className="font-mono text-foreground">
                {booking.driver_details.plateNumber}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Reference</span>
            <span className="truncate font-mono text-foreground">
              {booking.lalamove_order_id || "Pending"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Last synced</span>
            <span
              className={cn(
                "tabular-nums",
                stale
                  ? "font-medium text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground",
              )}
            >
              {stale ? "Delayed · " : ""}
              {dateLabel(booking.last_synced_at)}
            </span>
          </div>
        </div>

        {/* Proof of delivery */}
        {!!booking.evidence?.length && (
          <div className="space-y-1.5 border-t pt-3.5 text-xs">
            <p className="font-medium text-foreground">Proof of delivery</p>
            {booking.evidence.map((proof) => (
              <div
                key={proof.stop_id}
                className="flex items-center justify-between gap-2 text-muted-foreground"
              >
                <span className="truncate">
                  {proof.order_number
                    ? `Stop ${proof.stop_index ?? ""} · ${proof.order_number}: `
                    : ""}
                  {words(proof.status)}
                </span>
                {proof.delivered_at && (
                  <span className="shrink-0 tabular-nums">
                    {dateLabel(proof.delivered_at)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {booking.share_link && (
            <a
              href={booking.share_link}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ size: "sm" }),
                primaryCtaClass,
                "flex-1",
              )}
            >
              Track live
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={booking.share_link ? "" : "w-full"}
            disabled={busy || !booking.lalamove_order_id}
            onClick={() =>
              void perform("refresh", () =>
                api("POST", `/orders/${booking.id}/refresh`),
              )
            }
          >
            {pending === "refresh" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            )}
            {pending === "refresh" ? "Checking..." : "Refresh status"}
          </Button>
        </div>

        {/* Cancellation */}
        {canCancel && !confirmCancel && (
          <div className="border-t pt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
            >
              Cancel courier booking
            </button>
          </div>
        )}

        {canCancel && confirmCancel && (
          <div
            aria-label="Confirm courier cancellation"
            className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5"
          >
            <p className="text-xs font-semibold text-foreground">
              Cancel this courier booking?
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              The sales order stays open. Lalamove must accept the cancellation
              before rebooking.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void perform("cancel", () =>
                    api("POST", `/orders/${booking.id}/cancel`),
                  )
                }
              >
                {pending === "cancel" ? "Cancelling..." : "Confirm cancel"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmCancel(false)}
              >
                Keep
              </Button>
            </div>
          </div>
        )}

        {/* Admin reconciliation */}
        {canReconcile && booking.active && needsReview && (
          <details className="group border-t pt-3.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-foreground">
              <span>Admin reconciliation</span>
              <ChevronDown
                className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Check Lalamove Partner Portal before releasing this booking.
              </p>
              <label className="block space-y-1 text-xs font-medium">
                <span>Provider order ID (optional)</span>
                <Input
                  aria-label="Provider order ID for reconciliation"
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  placeholder="Existing Lalamove order ID"
                  className="h-9 text-xs"
                />
              </label>
              <label className="block space-y-1 text-xs font-medium">
                <span>Resolution note (min 15 chars)</span>
                <Input
                  aria-label="Reconciliation evidence"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Portal or support findings"
                  className="h-9 text-xs"
                />
              </label>
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={busy || note.trim().length < 15}
                onClick={() =>
                  void perform("reconcile", () =>
                    api("POST", `/orders/${booking.id}/reconcile`, {
                      note,
                      ...(providerId.trim()
                        ? { provider_order_id: providerId.trim() }
                        : {}),
                    }),
                  )
                }
              >
                {pending === "reconcile"
                  ? "Saving..."
                  : providerId.trim()
                    ? "Link and sync booking"
                    : "Release booking"}
              </Button>
            </div>
          </details>
        )}

        {booking.status === "COMPLETED" && (
          <p className="border-t pt-3 text-xs text-emerald-700 dark:text-emerald-400">
            Delivered. Payments remain managed in Orders.
          </p>
        )}
      </div>
    </section>
  );
}
