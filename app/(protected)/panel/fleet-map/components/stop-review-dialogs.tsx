"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ExternalLink,
  ImageIcon,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { request } from "@/components/http";
import { ViewOrderDetails } from "@/components/order-details";
import { QueryFeedback } from "@/components/query-feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OrderDetail } from "@/schema/order";
import { fleetApi } from "../api/fleet.api";
import type { DeliveryProofMeta, DeliveryStop } from "../types";

function ProofImage({
  stopId,
  proof,
  orderNumber,
}: {
  stopId: string;
  proof: DeliveryProofMeta;
  orderNumber: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [image, setImage] = useState<{ url?: string; error?: string }>({});
  const label =
    proof.kind === "signature" ? "Recipient signature" : "Delivery photo";

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    async function load() {
      setImage({});
      try {
        const response = await request(
          "GET",
          `/api/deliveries/stops/${encodeURIComponent(stopId)}/proofs/${proof.id}`,
        );
        if (!response.ok) throw new Error("Unable to load this proof image.");
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ url: objectUrl });
      } catch {
        if (active) setImage({ error: "Unable to load this proof image." });
      }
    }
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [stopId, proof.id, attempt]);

  return (
    <figure className="space-y-2.5 rounded-lg border p-3">
      <figcaption className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          Uploaded{" "}
          {new Date(proof.createdAt).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          (Manila)
        </p>
      </figcaption>
      {image.error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 text-sm text-destructive"
        >
          <span>{image.error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Retry
          </Button>
        </div>
      ) : image.url ? (
        <>
          {/* Authenticated proof bytes use a temporary local object URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={`${label} for order ${orderNumber}`}
            className="max-h-80 w-full rounded-md bg-white object-contain"
            onError={() =>
              setImage({ error: "Unable to display this proof image." })
            }
          />
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-4"
          >
            Open full-size{" "}
            {proof.kind === "signature" ? "signature" : "photo"}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </>
      ) : (
        <p role="status" className="py-6 text-center text-xs text-muted-foreground">
          Loading image…
        </p>
      )}
    </figure>
  );
}

export function StopProofDialog({
  stopId,
  orderNumber,
  open,
  onOpenChange,
}: {
  stopId: string;
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const proofs = useQuery({
    queryKey: ["delivery_proofs", stopId],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    queryFn: ({ signal }) => fleetApi.getStopProofs(stopId, signal),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Proof of delivery — {orderNumber}</DialogTitle>
          <DialogDescription>
            Photos and recipient signature uploaded by the driver for this
            delivery stop.
          </DialogDescription>
        </DialogHeader>
        <QueryFeedback query={proofs} label="proof of delivery" />
        {proofs.isPending && !proofs.isError ? (
          <p role="status" className="py-6 text-center text-sm text-muted-foreground">
            Loading proof of delivery…
          </p>
        ) : null}
        {proofs.isSuccess && proofs.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
            <ImageIcon
              className="size-6 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">No proof of delivery uploaded</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              The driver has not uploaded a photo or recipient signature for
              this stop yet.
            </p>
          </div>
        ) : null}
        {open && !proofs.isError && proofs.data && proofs.data.length > 0 ? (
          <div className="space-y-3">
            {proofs.data.map((proof) => (
              <ProofImage
                key={proof.id}
                stopId={stopId}
                proof={proof}
                orderNumber={orderNumber}
              />
            ))}
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={proofs.isFetching}
            onClick={() => void proofs.refetch()}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StopOrderDialog({
  orderId,
  orderNumber,
  open,
  onOpenChange,
}: {
  orderId: number;
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const order = useQuery({
    queryKey: ["order_view", orderId],
    enabled: open && orderId > 0,
    queryFn: async ({ signal }) => {
      const response = await request("GET", `/api/orders/${orderId}`);
      if (!response.ok) throw new Error("Unable to load this order.");
      const result = (await response.json()) as OrderDetail;
      signal.throwIfAborted();
      return result;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Order {orderNumber}</DialogTitle>
          <DialogDescription>
            Authorized order summary, saved destination, and itemized contents.
          </DialogDescription>
        </DialogHeader>
        <QueryFeedback query={order} label="order details" />
        {!order.isError || order.data ? (
          <ViewOrderDetails
            order={order.data ?? null}
            isLoading={order.isPending}
          />
        ) : null}
        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/panel/orders" />}
          >
            Open Orders module
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmStopDeliveryDialog({
  stop,
  sequence,
  open,
  busy,
  error,
  onOpenChange,
  onConfirm,
}: {
  stop: DeliveryStop;
  sequence: number;
  open: boolean;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");

  const proofs = useQuery({
    queryKey: ["delivery_proofs", stop.id],
    enabled: open,
    staleTime: 0,
    queryFn: ({ signal }) => fleetApi.getStopProofs(stop.id, signal),
  });

  const hasProof = (proofs.data?.length ?? 0) > 0;
  const requiresReason = proofs.isFetched && !hasProof;
  const reasonValid = !requiresReason || reason.trim().length >= 5;
  const canSubmit =
    !busy && !proofs.isPending && confirmed && reasonValid;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          if (!next) {
            setConfirmed(false);
            setReason("");
          }
          onOpenChange(next);
        }
      }}
    >
      <DialogContent showCloseButton={!busy} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review & confirm stop delivery</DialogTitle>
          <DialogDescription>
            Marking a stop delivered updates order{" "}
            <span className="font-medium text-foreground">{stop.order.id}</span>{" "}
            to Completed and cannot be undone from the map.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="font-semibold text-foreground">
              Stop #{sequence} · {stop.name}
            </p>
            <p className="text-muted-foreground">{stop.address}</p>
            <p className="pt-1 text-foreground">
              Affected order: <strong>{stop.order.id}</strong> (
              {stop.order.customer.name})
            </p>
          </div>

          {proofs.isPending ? (
            <div className="flex items-center gap-2 rounded-lg border p-3 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Checking uploaded proof of delivery…
            </div>
          ) : proofs.isError ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">Unable to verify Proof of Delivery</p>
                <p className="mt-0.5">
                  Proceed only if delivery has been verified directly with the
                  driver.
                </p>
              </div>
            </div>
          ) : hasProof ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">
                  Proof of Delivery on file ({proofs.data?.length} file
                  {proofs.data?.length === 1 ? "" : "s"})
                </p>
                <p className="mt-0.5">
                  Driver uploaded proof for this stop.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">
                  Manual override — No Proof of Delivery on file
                </p>
                <p className="mt-0.5">
                  Drivers normally confirm stops with photo/signature in the
                  mobile app. Enter an operational verification note below to
                  override.
                </p>
              </div>
            </div>
          )}

          {requiresReason ? (
            <label className="grid gap-1.5">
              <span className="font-medium text-foreground">
                Dispatcher override reason (required)
              </span>
              <textarea
                rows={2}
                disabled={busy}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g., Driver confirmed handoff via phone; mobile upload offline"
                className="w-full rounded-md border bg-background px-2.5 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          ) : null}

          <label className="flex items-start gap-2.5 leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I confirm stop <strong>#{sequence}</strong> (order{" "}
              <strong>{stop.order.id}</strong>) was physically delivered.
            </span>
          </label>

          {error ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => void onConfirm()}
          >
            {busy ? "Confirming…" : "Confirm delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
