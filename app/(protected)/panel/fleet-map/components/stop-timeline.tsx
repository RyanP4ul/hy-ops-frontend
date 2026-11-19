import { MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { groupStopsByVerifiedDestination } from "../lib/vehicle";
import type {
  Coordinates,
  DeliveryStop,
  StopEnrichment,
  Vehicle,
} from "../types";
import {
  ConfirmStopDeliveryDialog,
  StopOrderDialog,
  StopProofDialog,
} from "./stop-review-dialogs";

type StopTimelineProps = {
  stops: DeliveryStop[];
  vehicleStatus: Vehicle["status"];
  nextStopId: string | undefined;
  focusedStopId: string | null;
  enrichmentByStopId: Map<string, StopEnrichment>;
  simulationOn: boolean;
  savingStopId: string | null;
  stopActionError: string | null;
  onFocusStop: (coordinates: Coordinates) => void;
  onConfirmStopDelivered: (stopId: string) => Promise<boolean>;
};

export function StopTimeline({
  stops,
  vehicleStatus,
  nextStopId,
  focusedStopId,
  enrichmentByStopId,
  simulationOn,
  savingStopId,
  stopActionError,
  onFocusStop,
  onConfirmStopDelivered,
}: StopTimelineProps) {
  const groups = groupStopsByVerifiedDestination(stops, enrichmentByStopId);
  const [proofStop, setProofStop] = useState<{
    id: string;
    orderNumber: string;
  } | null>(null);
  const [orderModal, setOrderModal] = useState<{
    orderId: number;
    orderNumber: string;
  } | null>(null);
  const [confirmStop, setConfirmStop] = useState<{
    stop: DeliveryStop;
    sequence: number;
  } | null>(null);

  const detailsRefs = useRef(new Map<string, HTMLDetailsElement | null>());

  // When a stop is clicked on the map, open its native <details> and scroll it into view.
  useEffect(() => {
    if (!focusedStopId) return;
    const node = detailsRefs.current.get(focusedStopId);
    if (node) {
      node.open = true;
      node.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusedStopId]);

  return (
    <>
      <div className="divide-y divide-border/60 rounded-lg border bg-background">
        {groups.map((group) => {
          const isMultiOrder = group.entries.length > 1;

          return (
            <div key={group.key} className="px-2.5 py-2">
              {isMultiOrder ? (
                <div className="mb-1.5 flex items-start justify-between gap-2 pb-1.5 border-b border-border/50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-medium text-primary">
                        {group.entries.length} orders · same stop
                      </span>
                      {group.orderGroupNumber ? (
                        <span>· {group.orderGroupNumber}</span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs font-semibold text-foreground">
                      {group.destinationName}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {group.address}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFocusStop(group.coordinates)}
                    aria-label={`Locate ${group.destinationName}`}
                    title="Locate on map"
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <MapPin className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : null}

              <div className={cn(isMultiOrder && "divide-y divide-border/40")}>
                {group.entries.map(({ stop, sequence, enrichment }) => {
                  const actualStatus =
                    enrichment?.actualStatus ??
                    (stop.status === "completed" ? "delivered" : "pending");
                  const isDelivered = actualStatus === "delivered";
                  const isFailed = actualStatus === "failed";
                  const isSkipped =
                    !isDelivered && !isFailed && stop.skippedForNow;
                  const isNext =
                    !isDelivered &&
                    !isFailed &&
                    !isSkipped &&
                    stop.id === nextStopId;

                  const statusText = isDelivered
                    ? "Done"
                    : isFailed
                      ? "Failed"
                      : isSkipped
                        ? "Skipped"
                        : isNext
                          ? "Next"
                          : null;

                  return (
                    <details
                      key={stop.id}
                      ref={(el) => {
                        detailsRefs.current.set(stop.id, el);
                      }}
                      className={cn(
                        "fm-stop-details group",
                        isMultiOrder && "py-1.5 first:pt-0 last:pb-0",
                      )}
                    >
                      <summary className="flex items-start gap-2 rounded py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                            isDelivered &&
                              "bg-emerald-600 text-white",
                            isFailed && "bg-destructive text-white",
                            isNext && "bg-primary text-primary-foreground",
                            !isDelivered &&
                              !isFailed &&
                              !isNext &&
                              "border bg-muted/40 text-muted-foreground",
                          )}
                        >
                          {isDelivered ? "✓" : isFailed ? "!" : sequence}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-xs font-medium text-foreground">
                              {isMultiOrder ? stop.order.id : stop.name}
                            </span>
                            {statusText ? (
                              <span
                                className={cn(
                                  "shrink-0 text-[10px] font-medium",
                                  isDelivered &&
                                    "text-emerald-700 dark:text-emerald-400",
                                  isFailed && "text-destructive",
                                  isNext && "text-primary",
                                  isSkipped &&
                                    "text-amber-700 dark:text-amber-400",
                                )}
                              >
                                {statusText}
                              </span>
                            ) : null}
                          </span>

                          {!isMultiOrder ? (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {stop.address}
                            </span>
                          ) : null}

                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/90">
                            {!isMultiOrder ? `${stop.order.id} · ` : ""}
                            {stop.order.customer.name}
                            {enrichment?.orderGroupNumber && !isMultiOrder
                              ? ` · ${enrichment.orderGroupNumber}`
                              : ""}
                          </span>
                        </span>
                      </summary>

                      <div className="mt-2 space-y-2 border-t border-border/50 pl-6 pt-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-muted-foreground">
                            {stop.order.customer.code} ·{" "}
                            {stop.order.items.length}{" "}
                            {stop.order.items.length === 1 ? "item" : "items"}
                          </span>
                          {stop.order.customer.phone ? (
                            <a
                              href={`tel:${stop.order.customer.phone}`}
                              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-foreground hover:text-primary"
                            >
                              <Phone className="size-3" aria-hidden="true" />
                              {stop.order.customer.phone}
                            </a>
                          ) : null}
                        </div>

                        {isFailed && enrichment?.failureReason ? (
                          <p
                            role="alert"
                            className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive"
                          >
                            {enrichment.failureReason}
                          </p>
                        ) : null}

                        {enrichment?.returnStatus ? (
                          <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
                            Return pickup: {enrichment.returnStatus}
                          </p>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => onFocusStop(stop.coordinates)}
                          >
                            Locate
                          </Button>

                          {!simulationOn ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px]"
                              onClick={() =>
                                setProofStop({
                                  id: stop.id,
                                  orderNumber: stop.order.id,
                                })
                              }
                            >
                              Proof
                            </Button>
                          ) : null}

                          {enrichment?.orderId ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px]"
                              onClick={() =>
                                setOrderModal({
                                  orderId: enrichment.orderId,
                                  orderNumber: stop.order.id,
                                })
                              }
                            >
                              Order
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px]"
                              nativeButton={false}
                              render={<Link href="/panel/orders" />}
                            >
                              Orders
                            </Button>
                          )}

                          {!simulationOn &&
                          vehicleStatus === "delivering" &&
                          actualStatus === "pending" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              className="ml-auto h-6 px-2 text-[11px]"
                              disabled={savingStopId === stop.id}
                              onClick={() => setConfirmStop({ stop, sequence })}
                            >
                              Mark delivered
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {proofStop ? (
        <StopProofDialog
          stopId={proofStop.id}
          orderNumber={proofStop.orderNumber}
          open
          onOpenChange={(open) => {
            if (!open) setProofStop(null);
          }}
        />
      ) : null}

      {orderModal ? (
        <StopOrderDialog
          orderId={orderModal.orderId}
          orderNumber={orderModal.orderNumber}
          open
          onOpenChange={(open) => {
            if (!open) setOrderModal(null);
          }}
        />
      ) : null}

      {confirmStop ? (
        <ConfirmStopDeliveryDialog
          stop={confirmStop.stop}
          sequence={confirmStop.sequence}
          open
          busy={savingStopId === confirmStop.stop.id}
          error={stopActionError}
          onOpenChange={(open) => {
            if (!open) setConfirmStop(null);
          }}
          onConfirm={async () => {
            const ok = await onConfirmStopDelivered(confirmStop.stop.id);
            if (ok) setConfirmStop(null);
          }}
        />
      ) : null}
    </>
  );
}
