"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
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
  const label = proof.kind === "signature" ? "Signature" : "Photo";

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
        if (!response.ok) throw new Error("Unable to load image.");
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ url: objectUrl });
      } catch {
        if (active) setImage({ error: "Unable to load image." });
      }
    }
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [stopId, proof.id, attempt]);

  return (
    <figure className="space-y-2 rounded-lg border p-3">
      <figcaption className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {new Date(proof.createdAt).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </figcaption>
      {image.error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 py-4 text-xs text-destructive"
        >
          <span>{image.error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Retry
          </Button>
        </div>
      ) : image.url ? (
        <div className="space-y-2">
          <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-muted/30">
            {/* Authenticated proof bytes use a temporary local object URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={`${label} for order ${orderNumber}`}
              className="h-full w-full object-contain"
              onError={() => setImage({ error: "Unable to display image." })}
            />
          </div>
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open full size
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      ) : (
        <div
          role="status"
          className="grid aspect-[4/3] w-full place-items-center rounded-md bg-muted/30 text-xs text-muted-foreground"
        >
          Loading…
        </div>
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
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Proof · {orderNumber}</DialogTitle>
          <DialogDescription>
            Uploaded delivery photo and signature.
          </DialogDescription>
        </DialogHeader>
        <QueryFeedback query={proofs} label="proof of delivery" />
        {proofs.isPending && !proofs.isError ? (
          <p
            role="status"
            className="py-8 text-center text-xs text-muted-foreground"
          >
            Loading…
          </p>
        ) : null}
        {proofs.isSuccess && proofs.data.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
            No proof uploaded for this stop.
          </p>
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
            size="sm"
            disabled={proofs.isFetching}
            onClick={() => void proofs.refetch()}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
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
          <DialogDescription>Order summary and items.</DialogDescription>
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
            size="sm"
            nativeButton={false}
            render={<Link href="/panel/orders" />}
          >
            Open Orders
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
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
  const canSubmit = !busy && !proofs.isPending && confirmed && reasonValid;

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
          <DialogTitle>Confirm stop #{sequence}</DialogTitle>
          <DialogDescription>
            Marks order{" "}
            <span className="font-medium text-foreground">{stop.order.id}</span>{" "}
            completed. This cannot be undone here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="space-y-0.5 rounded-lg border bg-muted/25 p-3">
            <p className="font-semibold text-foreground">{stop.name}</p>
            <p className="text-muted-foreground">{stop.address}</p>
            <p className="pt-1 text-muted-foreground">
              {stop.order.id} · {stop.order.customer.name}
            </p>
          </div>

          {proofs.isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Checking proof…
            </div>
          ) : proofs.isError ? (
            <p className="rounded-md border border-amber-300 bg-amber-50/80 px-3 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              Could not verify proof. Proceed only if confirmed with driver.
            </p>
          ) : hasProof ? (
            <p className="rounded-md border border-emerald-300 bg-emerald-50/80 px-3 py-2 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              Proof on file ({proofs.data?.length}).
            </p>
          ) : (
            <p className="rounded-md border border-amber-300 bg-amber-50/80 px-3 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              No proof uploaded. Add a short override note below.
            </p>
          )}

          {requiresReason ? (
            <label className="grid gap-1">
              <span className="font-medium text-foreground">Override note</span>
              <textarea
                rows={2}
                disabled={busy}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Driver confirmed by phone"
                className="w-full rounded-md border bg-background px-2.5 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          ) : null}

          <label className="flex items-start gap-2 leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I confirm order <strong>{stop.order.id}</strong> was delivered.
            </span>
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit}
            onClick={() => void onConfirm()}
          >
            {busy ? "Confirming…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
