"use client";

import { use, useEffect, useState } from "react";
import { CheckCircle2, Clock, Package, Truck, XCircle } from "lucide-react";

type TrackingPayload = {
  order_number: string;
  status: string;
  delivery_method: string | null;
  warehouse_name: string;
  created_at: string;
  updated_at: string;
  delivery: {
    delivery_status: string;
    scheduled_date: string;
    departure_time: string;
    stop_status: string;
    delivered_at: string | null;
  } | null;
  items: {
    product_name: string;
    variant_name: string;
    quantity: number;
    unit: string;
  }[];
};

const STEPS = [
  { key: "PENDING", label: "Order placed" },
  { key: "PROCESSING", label: "Preparing" },
  { key: "SCHEDULING", label: "Ready for dispatch" },
  { key: "SCHEDULED", label: "Delivery scheduled" },
  { key: "IN_TRANSIT", label: "Out for delivery" },
  { key: "COMPLETED", label: "Delivered" },
] as const;

export default function PublicOrderTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<TrackingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/public/track/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message ?? "Tracking link not found.");
        }
        return json as TrackingPayload;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Unable to load tracking.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const currentIdx = data
    ? STEPS.findIndex((s) => s.key === data.status)
    : -1;
  const cancelled = data?.status === "CANCELLED";

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-10">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              HYOps Order Tracking
            </p>
            <h1 className="mt-1 text-xl font-semibold">
              {loading
                ? "Loading order…"
                : data
                  ? data.order_number
                  : "Tracking unavailable"}
            </h1>
          </div>
          <Package className="size-7 text-muted-foreground" />
        </div>

        {loading && (
          <p role="status" className="py-12 text-center text-sm text-muted-foreground">
            Fetching latest status…
          </p>
        )}

        {!loading && error && (
          <div role="alert" className="py-10 text-center">
            <XCircle className="mx-auto mb-2 size-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
        )}

        {!loading && data && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-semibold">{data.status.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fulfillment warehouse</p>
                <p className="font-medium">{data.warehouse_name}</p>
              </div>
              {data.delivery ? (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Scheduled delivery</p>
                  <p className="flex items-center gap-1.5 font-medium">
                    <Truck className="size-4" />
                    {data.delivery.scheduled_date} · {data.delivery.departure_time.slice(0, 5)} (Asia/Manila)
                  </p>
                </div>
              ) : null}
            </div>

            {cancelled ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                This order has been cancelled.
              </div>
            ) : (
              <ol className="space-y-3">
                {STEPS.map((step, idx) => {
                  const done = currentIdx >= idx;
                  const active = currentIdx === idx;
                  return (
                    <li
                      key={step.key}
                      className="flex items-center gap-3 text-sm"
                    >
                      {done ? (
                        <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                      ) : (
                        <Clock className="size-5 shrink-0 text-muted-foreground/50" />
                      )}
                      <span
                        className={
                          active
                            ? "font-semibold text-foreground"
                            : done
                              ? "text-foreground/90"
                              : "text-muted-foreground"
                        }
                      >
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="border-t pt-4">
              <h2 className="mb-2 text-sm font-semibold">Items ({data.items.length})</h2>
              <ul className="divide-y rounded-lg border text-sm">
                {data.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-4 px-3 py-2"
                  >
                    <span>
                      {item.product_name} — {item.variant_name}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {item.quantity} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
