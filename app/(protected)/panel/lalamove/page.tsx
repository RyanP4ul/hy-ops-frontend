"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Package,
  RefreshCw,
  Send,
  Truck,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type FormValues = {
  service_type: string;
  pickup_address: string;
  pickup_latitude: string;
  pickup_longitude: string;
  dropoff_address: string;
  dropoff_latitude: string;
  dropoff_longitude: string;
  sender_name: string;
  sender_phone: string;
  recipient_name: string;
  recipient_phone: string;
};

type LalamoveQuotation = {
  quotationId: string;
  expiresAt?: string;
  serviceType?: string;
  priceBreakdown?: {
    total?: string;
    currency?: string;
  };
  stops?: Array<{ stopId: string; address?: string }>;
};

type PlacedOrder = {
  id?: string;
  orderId?: string;
  quotationId?: string;
  status?: string;
  deliveryFee?: string | null;
  currency?: string | null;
  shareLink?: string;
};

const initialValues: FormValues = {
  service_type: "",
  pickup_address: "",
  pickup_latitude: "",
  pickup_longitude: "",
  dropoff_address: "",
  dropoff_latitude: "",
  dropoff_longitude: "",
  sender_name: "HY Company",
  sender_phone: "",
  recipient_name: "",
  recipient_phone: "",
};

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body.message === "string"
        ? body.message
        : body && typeof body.error === "string"
          ? body.error
          : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  step,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  step?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        step={step}
        autoComplete={autoComplete}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function currencyLabel(total?: string, currency = "PHP") {
  if (total == null || total.trim() === "") return "Price not provided";
  const amount = Number(total);
  if (!Number.isFinite(amount)) return "Invalid amount";
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${total}`;
  }
}

export default function Page() {
  const [form, setForm] = useState<FormValues>(initialValues);
  const [quotation, setQuotation] = useState<LalamoveQuotation | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

  const quoteExpired = useMemo(() => {
    if (!quotation?.expiresAt) return false;
    const expiration = Date.parse(quotation.expiresAt);
    return Number.isFinite(expiration) && expiration <= Date.now();
  }, [quotation]);

  const updateField = (field: keyof FormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (quotation) setQuotation(null);
    if (placedOrder) setPlacedOrder(null);
  };

  const createQuotation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPlacedOrder(null);
    setQuotation(null);

    const numericFields = [
      ["Pickup latitude", form.pickup_latitude, -90, 90],
      ["Pickup longitude", form.pickup_longitude, -180, 180],
      ["Drop-off latitude", form.dropoff_latitude, -90, 90],
      ["Drop-off longitude", form.dropoff_longitude, -180, 180],
    ] as const;

    for (const [label, value, min, max] of numericFields) {
      const number = Number(value);
      if (
        value.trim() === "" ||
        !Number.isFinite(number) ||
        number < min ||
        number > max
      ) {
        setError(
          `${label} must be a valid coordinate between ${min} and ${max}.`,
        );
        return;
      }
    }

    setIsQuoting(true);
    try {
      const response = await fetch("/api/lalamove/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type: form.service_type.trim(),
          pickup_address: form.pickup_address.trim(),
          pickup_latitude: Number(form.pickup_latitude),
          pickup_longitude: Number(form.pickup_longitude),
          dropoff_address: form.dropoff_address.trim(),
          dropoff_latitude: Number(form.dropoff_latitude),
          dropoff_longitude: Number(form.dropoff_longitude),
        }),
      });

      const result = await readApiResponse<
        { data?: LalamoveQuotation } & LalamoveQuotation
      >(response);
      const nextQuotation = result.data ?? result;
      if (!nextQuotation?.quotationId) {
        throw new Error("The API response did not include a quotation ID.");
      }
      setQuotation(nextQuotation);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create a Lalamove quotation.",
      );
    } finally {
      setIsQuoting(false);
    }
  };

  const placeOrder = async () => {
    if (!quotation) return;
    setError(null);

    if (quotation.expiresAt && Date.parse(quotation.expiresAt) <= Date.now()) {
      setError(
        "This quotation has expired. Request a new quotation before placing the order.",
      );
      setQuotation(null);
      return;
    }

    setIsPlacing(true);
    try {
      const response = await fetch("/api/lalamove/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotation_id: quotation.quotationId,
          sender_name: form.sender_name.trim(),
          sender_phone: form.sender_phone.trim(),
          recipient_name: form.recipient_name.trim(),
          recipient_phone: form.recipient_phone.trim(),
          pickup_address: form.pickup_address.trim(),
          dropoff_address: form.dropoff_address.trim(),
        }),
      });

      const result = await readApiResponse<{
        message?: string;
        data?: PlacedOrder;
        orderId?: string;
      }>(response);
      const orderData = result.data ?? result;
      setPlacedOrder(orderData);
      setQuotation(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to place the Lalamove order.",
      );
    } finally {
      setIsPlacing(false);
    }
  };

  const resetForm = () => {
    setForm(initialValues);
    setQuotation(null);
    setPlacedOrder(null);
    setError(null);
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button nativeButton={false} render={<Link href="/panel/deliveries" />} variant="ghost" size="sm" className="-ml-3 w-fit">
              <ArrowLeft className="mr-2 size-4" /> Back to deliveries
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Create Lalamove order
              </h1>
              <p className="text-sm text-muted-foreground">
                Get a live quotation, review the fee, then confirm the booking.
              </p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="w-fit gap-2 px-3 py-1.5">
          <span className="size-2 rounded-full bg-amber-500" /> Sandbox workflow
        </Badge>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to continue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {placedOrder ? (
        <Alert className="border-emerald-600/30 bg-emerald-600/5">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <AlertTitle>Lalamove order placed</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>
              Your booking was accepted by the Lalamove API and the response was
              returned to HYOps.
            </p>
            <div className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Lalamove order ID
                </p>
                <p className="break-all font-mono text-sm font-medium">
                  {placedOrder.id ?? placedOrder.orderId ?? "Not returned"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Provider status</p>
                <p className="text-sm font-medium">
                  {placedOrder.status ?? "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Delivery fee</p>
                <p className="text-sm font-medium">
                  {currencyLabel(
                    placedOrder.deliveryFee ?? undefined,
                    placedOrder.currency ?? "PHP",
                  )}
                </p>
              </div>
            </div>
            {placedOrder.shareLink ? (
              <a
                href={placedOrder.shareLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Open Lalamove tracking link{" "}
                <ExternalLink className="ml-1 size-3.5" />
              </a>
            ) : null}
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={resetForm}
                className="mt-2"
              >
                Create another order
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={createQuotation} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="size-5 text-primary" />
                <CardTitle>Route details</CardTitle>
              </div>
              <CardDescription>
                Provide the pickup and customer drop-off locations. Coordinates
                should come from verified HYOps addresses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="service_type">
                  Lalamove service type{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="service_type"
                  value={form.service_type}
                  onChange={(event) =>
                    updateField("service_type", event.target.value)
                  }
                  placeholder="Exact serviceType, e.g. MOTORCYCLE"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use the exact service type for your PH service area.{" "}
                  <a
                    href="/api/lalamove/cities"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    View Lalamove city configuration{" "}
                    <ExternalLink className="inline size-3" />
                  </a>
                </p>
              </div>
              <Separator />
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <h3 className="font-medium">Pickup location</h3>
                    <p className="text-xs text-muted-foreground">
                      HY Company warehouse
                    </p>
                  </div>
                </div>
                <Field
                  id="pickup_address"
                  label="Pickup address"
                  value={form.pickup_address}
                  onChange={(value) => updateField("pickup_address", value)}
                  placeholder="Full warehouse address"
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="pickup_latitude"
                    label="Latitude"
                    type="number"
                    step="any"
                    value={form.pickup_latitude}
                    onChange={(value) => updateField("pickup_latitude", value)}
                    placeholder="14.815000"
                    required
                  />
                  <Field
                    id="pickup_longitude"
                    label="Longitude"
                    type="number"
                    step="any"
                    value={form.pickup_longitude}
                    onChange={(value) => updateField("pickup_longitude", value)}
                    placeholder="120.906000"
                    required
                  />
                </div>
              </section>
              <Separator />
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <h3 className="font-medium">Drop-off location</h3>
                    <p className="text-xs text-muted-foreground">
                      Customer delivery address
                    </p>
                  </div>
                </div>
                <Field
                  id="dropoff_address"
                  label="Drop-off address"
                  value={form.dropoff_address}
                  onChange={(value) => updateField("dropoff_address", value)}
                  placeholder="Full customer delivery address"
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="dropoff_latitude"
                    label="Latitude"
                    type="number"
                    step="any"
                    value={form.dropoff_latitude}
                    onChange={(value) => updateField("dropoff_latitude", value)}
                    placeholder="14.850000"
                    required
                  />
                  <Field
                    id="dropoff_longitude"
                    label="Longitude"
                    type="number"
                    step="any"
                    value={form.dropoff_longitude}
                    onChange={(value) =>
                      updateField("dropoff_longitude", value)
                    }
                    placeholder="120.980000"
                    required
                  />
                </div>
              </section>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="size-5 text-primary" />
                <CardTitle>Contact details</CardTitle>
              </div>
              <CardDescription>
                These contact details are shared with the Lalamove driver.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">
                  Sender / pickup contact
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="sender_name"
                    label="Sender name"
                    value={form.sender_name}
                    onChange={(value) => updateField("sender_name", value)}
                    placeholder="HY Company"
                    required
                    autoComplete="name"
                  />
                  <Field
                    id="sender_phone"
                    label="Sender phone"
                    value={form.sender_phone}
                    onChange={(value) => updateField("sender_phone", value)}
                    placeholder="+639XXXXXXXXX"
                    required
                    autoComplete="tel"
                  />
                </div>
              </section>
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">
                  Recipient / customer contact
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="recipient_name"
                    label="Recipient name"
                    value={form.recipient_name}
                    onChange={(value) => updateField("recipient_name", value)}
                    placeholder="Customer contact person"
                    required
                    autoComplete="name"
                  />
                  <Field
                    id="recipient_phone"
                    label="Recipient phone"
                    value={form.recipient_phone}
                    onChange={(value) => updateField("recipient_phone", value)}
                    placeholder="+639XXXXXXXXX"
                    required
                    autoComplete="tel"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use international phone format, such as +639XXXXXXXXX.
                </p>
              </section>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isQuoting || isPlacing}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={isQuoting || isPlacing || Boolean(placedOrder)}
                >
                  {isQuoting ? (
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 size-4" />
                  )}
                  Get quotation
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <aside className="space-y-6">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ReceiptIcon />
                <CardTitle>Quotation summary</CardTitle>
              </div>
              <CardDescription>
                Review the provider quote before booking.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!quotation ? (
                <div className="flex flex-col items-center rounded-lg border border-dashed p-6 text-center">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                    <Truck className="size-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No quotation yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Complete the route details and choose “Get quotation”.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Estimated Lalamove fee
                    </p>
                    <p className="text-3xl font-semibold tracking-tight">
                      {currencyLabel(
                        quotation.priceBreakdown?.total,
                        quotation.priceBreakdown?.currency ?? "PHP",
                      )}
                    </p>
                    <Badge variant="secondary">
                      {quotation.serviceType ?? form.service_type}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium">Pickup</p>
                        <p className="break-words text-muted-foreground">
                          {form.pickup_address}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="font-medium">Drop-off</p>
                        <p className="break-words text-muted-foreground">
                          {form.dropoff_address}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Package className="size-3.5" />
                      <span>Quotation ID</span>
                    </div>
                    <p className="break-all font-mono text-foreground">
                      {quotation.quotationId}
                    </p>
                    {quotation.expiresAt ? (
                      <div className="flex items-center gap-2 pt-1">
                        <Clock3 className="size-3.5" />
                        <span>
                          {quoteExpired
                            ? "Quotation expired"
                            : `Expires ${new Date(quotation.expiresAt).toLocaleString()}`}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {quoteExpired ? (
                    <Alert variant="destructive">
                      <AlertTitle>Quotation expired</AlertTitle>
                      <AlertDescription>
                        Request a fresh quotation before placing the order.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <Button
                    className="w-full"
                    onClick={placeOrder}
                    disabled={isPlacing || isQuoting || quoteExpired}
                  >
                    {isPlacing ? (
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 size-4" />
                    )}
                    {isPlacing ? "Placing order…" : "Confirm and place order"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Placing an order submits a booking request to Lalamove.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Alert>
            <Clock3 className="size-4" />
            <AlertTitle>Quotation validity</AlertTitle>
            <AlertDescription>
              Lalamove v3 quotations are valid for about five minutes. Confirm
              the order promptly and request a new quote if it expires.
            </AlertDescription>
          </Alert>
        </aside>
      </div>
    </main>
  );
}

function ReceiptIcon() {
  return <Package className="size-5 text-primary" />;
}
