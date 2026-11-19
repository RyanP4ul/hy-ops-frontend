import {
  AlertCircle,
  Check,
  ChevronDown,
  ExternalLink,
  ImageIcon,
  Layers,
  MapPin,
  Phone,
  ShieldAlert,
} from "lucide-react";
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
  expandedId: string | null;
  enrichmentByStopId: Map<string, StopEnrichment>;
  simulationOn: boolean;
  savingStopId: string | null;
  stopActionError: string | null;
  onToggle: (stopId: string) => void;
  onFocusStop: (coordinates: Coordinates) => void;
  onConfirmStopDelivered: (stopId: string) => Promise<boolean>;
};

export function StopTimeline({
  stops,
  vehicleStatus,
  nextStopId,
  expandedId,
  enrichmentByStopId,
  simulationOn,
  savingStopId,
  stopActionError,
  onToggle,
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

  const rowRefs = useRef(new Map<string, HTMLDivElement | null>());

  useEffect(() => {
    if (!expandedId) return;
    const node = rowRefs.current.get(expandedId);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [expandedId]);

  return (
    <>
      <div className="space-y-2.5">
        {groups.map((group) => {
          const isMultiOrder = group.entries.length > 1;
          const seqRange = isMultiOrder
            ? `Stops #${group.entries[0].sequence}–#${group.entries[group.entries.length - 1].sequence}`
            : `Stop #${group.entries[0].sequence}`;

          return (
            <div
              key={group.key}
              className="rounded-lg border bg-card/60 p-2.5"
            >
              {isMultiOrder ? (
                <div className="mb-2 flex items-start justify-between gap-2 border-b pb-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        <Layers className="size-3" aria-hidden="true" />
                        {seqRange} · {group.entries.length} orders
                      </span>
                      {group.orderGroupNumber ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {group.orderGroupNumber}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-foreground">
                      {group.destinationName}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {group.address}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFocusStop(group.coordinates)}
                    aria-label={`Focus ${group.destinationName} on map`}
                    className="shrink-0 rounded border bg-background p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Focus destination on map"
                  >
                    <MapPin className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : null}

              <ol className="space-y-2">
                {group.entries.map(({ stop, sequence, enrichment }) => {
                  const actualStatus =
                    enrichment?.actualStatus ??
                    (stop.status === "completed" ? "delivered" : "pending");
                  const isDelivered = actualStatus === "delivered";
                  const isFailed = actualStatus === "failed";
                  const isSkipped = !isDelivered && !isFailed && stop.skippedForNow;
                  const isNext = !isDelivered && !isFailed && !isSkipped && stop.id === nextStopId;
                  const expanded = expandedId === stop.id;

                  return (
                    <li key={stop.id}>
                      <div
                        ref={(el) => {
                          rowRefs.current.set(stop.id, el);
                        }}
                        className={cn(
                          "rounded-md transition-colors",
                          isMultiOrder && "border bg-background/80 p-2",
                          expanded && "ring-1 ring-primary/40",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onToggle(stop.id)}
                          aria-expanded={expanded}
                          className="flex w-full items-start gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                              isDelivered &&
                                "border-emerald-600 bg-emerald-600 text-white",
                              isFailed &&
                                "border-destructive bg-destructive text-white",
                              isNext &&
                                "border-primary bg-primary text-primary-foreground",
                              !isDelivered &&
                                !isFailed &&
                                !isNext &&
                                "border-border bg-background text-muted-foreground",
                            )}
                          >
                            {isDelivered ? (
                              <Check className="size-3.5" aria-hidden="true" />
                            ) : isFailed ? (
                              <AlertCircle className="size-3.5" aria-hidden="true" />
                            ) : (
                              sequence
                            )}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-foreground">
                                {isMultiOrder ? stop.order.id : stop.name}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                  isDelivered &&
                                    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
                                  isFailed &&
                                    "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
                                  isNext && "bg-primary/10 text-primary",
                                  isSkipped && "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                                  !isDelivered &&
                                    !isFailed &&
                                    !isNext &&
                                    !isSkipped &&
                                    "bg-muted text-muted-foreground",
                                )}
                              >
                                {isDelivered
                                  ? "Delivered"
                                  : isFailed
                                    ? "Failed"
                                    : isSkipped
                                      ? "Skipped for now"
                                    : isNext
                                      ? "Next stop"
                                      : "Pending"}
                              </span>
                            </div>

                            {!isMultiOrder ? (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {stop.address}
                              </p>
                            ) : null}

                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              {!isMultiOrder ? (
                                <span className="font-medium text-foreground/80">
                                  {stop.order.id}
                                </span>
                              ) : null}
                              <span>· {stop.order.customer.name}</span>
                              {enrichment?.orderGroupNumber && !isMultiOrder ? (
                                <span className="rounded bg-muted px-1 py-0.25 text-[10px]">
                                  {enrichment.orderGroupNumber}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <ChevronDown
                            className={cn(
                              "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                              expanded && "rotate-180",
                            )}
                            aria-hidden="true"
                          />
                        </button>

                        {expanded ? (
                          <div className="mt-2.5 space-y-2.5 border-t pt-2.5 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">
                                  {stop.order.customer.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {stop.order.customer.code} ·{" "}
                                  {stop.order.items.length} line item
                                  {stop.order.items.length === 1 ? "" : "s"}
                                </p>
                              </div>
                              {stop.order.customer.phone ? (
                                <a
                                  href={`tel:${stop.order.customer.phone}`}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
                                >
                                  <Phone className="size-3" aria-hidden="true" />
                                  {stop.order.customer.phone}
                                </a>
                              ) : null}
                            </div>

                            {isFailed && enrichment?.failureReason ? (
                              <div
                                role="alert"
                                className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive"
                              >
                                <strong>Failure reason:</strong>{" "}
                                {enrichment.failureReason}
                              </div>
                            ) : null}

                            {enrichment?.returnStatus ? (
                              <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
                                Return pickup status: {enrichment.returnStatus}
                              </p>
                            ) : null}

                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2 text-[11px]"
                                onClick={() => onFocusStop(stop.coordinates)}
                              >
                                <MapPin className="size-3" aria-hidden="true" />
                                Focus stop
                              </Button>

                              {!simulationOn ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 px-2 text-[11px]"
                                  onClick={() =>
                                    setProofStop({
                                      id: stop.id,
                                      orderNumber: stop.order.id,
                                    })
                                  }
                                >
                                  <ImageIcon
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  View proof
                                </Button>
                              ) : null}

                              {enrichment?.orderId ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 px-2 text-[11px]"
                                  onClick={() =>
                                    setOrderModal({
                                      orderId: enrichment.orderId,
                                      orderNumber: stop.order.id,
                                    })
                                  }
                                >
                                  <ExternalLink
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  View full order details
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 px-2 text-[11px]"
                                  nativeButton={false}
                                  render={<Link href="/panel/orders" />}
                                >
                                  <ExternalLink
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  Orders module
                                </Button>
                              )}

                              {!simulationOn &&
                              vehicleStatus === "delivering" &&
                              actualStatus === "pending" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 border-primary/40 px-2 text-[11px] text-primary hover:bg-primary/5"
                                  disabled={savingStopId === stop.id}
                                  onClick={() =>
                                    setConfirmStop({ stop, sequence })
                                  }
                                >
                                  <ShieldAlert
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  Review delivery
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
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
