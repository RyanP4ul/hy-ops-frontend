"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Clock3, CreditCard, Loader2, MapPin, PackageCheck, Phone, ShieldCheck, Truck, UserRound, Warehouse } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PickupWarehouseSelector, warehouseAddress, type PickupFeedback } from "./pickup-warehouse-selector";
import type { City, Context, Quotation } from "../types";
import { money, primaryClass, selectClass, words } from "./presentation";

type Feedback = PickupFeedback;

export function DeliveryDetails({ data, busy, saving, feedback, onSave, onMethod }: { data: Context; busy: boolean; saving: boolean; feedback: Feedback; onSave: (warehouseId: number) => void; onMethod: (method: string) => void }) {
  const hasContact = !!data.warehouse.phone_number;
  const [contactOpen, setContactOpen] = useState(!hasContact);
  const locked = data.bookings.some(booking => booking.active) || !["PENDING", "PROCESSING", "SCHEDULING"].includes(data.order.status);
  return <Card>
    <CardHeader><h2 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-orange-600" aria-hidden="true" />Delivery details</h2><p className="text-sm text-muted-foreground">Review the saved route and who the courier should contact.</p></CardHeader>
    <CardContent className="space-y-6">
      <label className="block space-y-2 text-sm font-medium">Delivery method<select aria-label="Delivery method" className={selectClass} value={data.order.delivery_method || ""} disabled={busy || locked} onChange={event => onMethod(event.target.value)}><option value="" disabled>Select method</option><option value="INTERNAL">Company delivery</option><option value="PICKUP">Customer pickup</option><option value="LALAMOVE">Lalamove</option></select></label>
      {locked && <p className="-mt-3 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" aria-hidden="true" />Delivery method is locked while this order is scheduled or has an unresolved booking.</p>}
      <div className="relative space-y-6 rounded-xl border bg-muted/15 p-4 sm:p-5">
        <div aria-hidden="true" className="absolute top-12 bottom-12 left-[35px] w-px bg-border sm:left-[39px]" />
        <div className="relative flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background"><Warehouse className="size-4 text-muted-foreground" aria-hidden="true" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pickup · Warehouse</p><h3 className="mt-1 break-words text-sm font-semibold">{data.warehouse.name}</h3><p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">{warehouseAddress(data.warehouse) || "Warehouse address is missing"}</p><p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><UserRound className="size-3" aria-hidden="true" />{data.warehouse.name}</span>{data.warehouse.phone_number && <span className="inline-flex items-center gap-1"><Phone className="size-3" aria-hidden="true" />{data.warehouse.phone_number}</span>}</p></div></div>
        <div className="relative flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300"><MapPin className="size-4" aria-hidden="true" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Drop-off · Customer</p><h3 className="mt-1 break-words text-sm font-semibold">{data.order.shipping_recipient || "Recipient needs attention"}</h3><p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">{data.order.shipping_address || "Confirm the order destination before requesting a quote."}</p></div></div>
      </div>
      <details open={contactOpen} onToggle={event => setContactOpen(event.currentTarget.open)} className="group rounded-xl border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium"><span className="flex flex-wrap items-center gap-2"><span>Warehouse pickup contact</span><Badge variant="outline" className={hasContact ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>{hasContact ? "Saved" : "Required"}</Badge></span><ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
        <div className="space-y-3 border-t px-4 pt-4 pb-4">
          <PickupWarehouseSelector orderId={data.order.id} warehouse={data.warehouse} locked={locked} busy={busy} saving={saving} feedback={feedback} onSave={onSave} />
        </div>
      </details>
    </CardContent>
  </Card>;
}

export function ServicePanel({ cities, city, service, disabled, loading, error, onCity, onService, retry }: { cities: City[]; city: string; service: string; disabled: boolean; loading: boolean; error?: string; onCity: (value: string) => void; onService: (value: string) => void; retry: () => void }) {
  const services = cities.find(item => item.locode === city)?.services || [];
  const chosen = services.find(item => item.key === service);
  return <Card><CardHeader><h2 className="flex items-center gap-2 font-semibold"><Truck className="size-4 text-orange-600" aria-hidden="true" />Choose your courier service</h2><p className="text-sm text-muted-foreground">Select an operating city and a vehicle suitable for your goods.</p></CardHeader><CardContent className="space-y-4">
    {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading available services…</p>}
    {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" onClick={retry}>Retry services</Button></div>}
    <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium">Operating city<select aria-label="Operating city" className={selectClass} value={city} disabled={disabled || loading} onChange={event => onCity(event.target.value)}><option value="">Select city</option>{cities.map(item => <option key={item.locode} value={item.locode}>{item.name}</option>)}</select></label><label className="block space-y-2 text-sm font-medium">Vehicle service<select aria-label="Vehicle service" className={selectClass} value={service} disabled={disabled || !city} onChange={event => onService(event.target.value)}><option value="">Select service</option>{services.map(item => <option key={item.key} value={item.key}>{words(item.key)}{item.description ? ` — ${item.description}` : ""}</option>)}</select></label></div>
    {chosen ? <div className="flex gap-3 rounded-xl border border-orange-200/70 bg-orange-50/40 p-4 dark:border-orange-900 dark:bg-orange-950/20"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-background text-orange-600"><Truck className="size-5" aria-hidden="true" /></span><div className="min-w-0 space-y-2"><h3 className="text-sm font-semibold">{words(chosen.key)}</h3>{chosen.description && <p className="text-xs leading-relaxed text-muted-foreground">{chosen.description}</p>}<div className="flex flex-wrap gap-2">{chosen.load && <Badge variant="outline">Up to {chosen.load.value} {chosen.load.unit}</Badge>}{chosen.dimensions && Object.entries(chosen.dimensions).map(([key, dimension]) => <Badge key={key} variant="outline" className="capitalize">{key}: {dimension.value} {dimension.unit}</Badge>)}</div></div></div> : <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><PackageCheck className="size-4 shrink-0" aria-hidden="true" />Vehicle dimensions and load limits will appear after you select a service.</p>}
  </CardContent></Card>;
}

export function QuotePanel({ data, quote, service, now, busy, quoting, booking, confirmed, onConfirmed, onQuote, onBook }: { data: Context; quote: Quotation | null; service?: City["services"][number]; now: number; busy: boolean; quoting: boolean; booking: boolean; confirmed: boolean; onConfirmed: (value: boolean) => void; onQuote: () => void; onBook: () => void }) {
  const seconds = quote ? Math.max(0, Math.ceil((Date.parse(quote.expiresAt) - now) / 1000)) : 0;
  const expired = !!quote && seconds <= 0;
  const isLalamove = data.order.delivery_method === "LALAMOVE";
  const canQuote = data.enabled && data.eligible && !!service && isLalamove;
  return <Card className="overflow-hidden ring-orange-200 dark:ring-orange-900">
    <CardHeader className="border-b bg-orange-50/60 dark:bg-orange-950/20"><h2 tabIndex={-1} className="flex items-center gap-2 font-semibold outline-none"><CreditCard className="size-4 text-orange-600" aria-hidden="true" />Delivery quotation</h2><p className="text-xs leading-relaxed text-muted-foreground">Review the fee before you confirm a courier.</p></CardHeader>
    <CardContent className="space-y-5">
      {!data.enabled && <p role="status" className="rounded-lg bg-muted p-3 text-sm leading-relaxed">New bookings are disabled. Existing bookings can still be tracked.</p>}
      {!!data.bookings.length && !data.bookings.some(attempt => attempt.active) && <p role="status" className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed">The previous courier attempt has ended. Request a fresh quotation to book again; previous attempts remain available below.</p>}
      {!isLalamove ? <div className="space-y-3 py-3 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-muted"><Truck className="size-6 text-muted-foreground" aria-hidden="true" /></span><p className="text-sm font-medium">Choose Lalamove to get started</p><p className="text-xs leading-relaxed text-muted-foreground">Set the delivery method to Lalamove in the delivery details. Then select a city and vehicle service.</p></div> : <>
        {!data.eligible && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{data.reason}</p>}
        {quote ? <>
          <div><p className="text-xs text-muted-foreground">Estimated courier fee</p><p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{money(quote.priceBreakdown.total, quote.priceBreakdown.currency)}</p><p className="mt-2 text-sm text-muted-foreground">{words(quote.serviceType)}</p></div>
          <p role="timer" aria-label="Quotation time remaining" className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium ${expired ? "bg-destructive/5 text-destructive" : "bg-muted/60 text-muted-foreground"}`}><Clock3 className="size-3.5" aria-hidden="true" />{expired ? "Quotation expired. Request a new one." : `Price valid for ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</p>
          <div className="space-y-3 border-y py-4 text-xs"><div><p className="font-medium">Pickup</p><p className="mt-1 break-words leading-relaxed text-muted-foreground">{quote.route.pickup.address}</p></div><div><p className="font-medium">Drop-off</p><p className="mt-1 break-words leading-relaxed text-muted-foreground">{quote.route.dropoff.address}</p></div></div>
          <details className="group"><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium">Fee breakdown<ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><dl className="mt-3 space-y-2">{Object.entries(quote.priceBreakdown).filter(([key]) => !["total", "currency"].includes(key)).map(([key, value]) => <div key={key} className="flex justify-between gap-4 text-xs"><dt className="text-muted-foreground">{words(key)}</dt><dd className="text-right tabular-nums">{money(value, quote.priceBreakdown.currency)}</dd></div>)}<div className="flex justify-between gap-4 border-t pt-2 text-xs font-semibold"><dt>Total</dt><dd>{money(quote.priceBreakdown.total, quote.priceBreakdown.currency)}</dd></div></dl></details>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"><input className="mt-0.5 size-4 shrink-0 accent-orange-600" type="checkbox" checked={confirmed} disabled={busy || expired} onChange={event => onConfirmed(event.target.checked)} /><span><span className="block text-xs font-medium">Package fits the selected vehicle</span><span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">I checked the dimensions, weight and service suitability.</span></span></label>
          <Button className={`h-11 w-full ${primaryClass}`} disabled={busy || expired || !confirmed || !data.enabled || !data.eligible} onClick={onBook}>{booking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}{booking ? "Confirming…" : "Confirm and book Lalamove"}</Button>
          <Button variant="outline" className="w-full" disabled={busy || !canQuote} onClick={onQuote}>{quoting ? "Requesting quotation…" : "Get new quotation"}</Button>
        </> : <>
          <div className="rounded-xl border border-dashed bg-muted/15 p-5 text-center"><p className="text-sm font-medium">Your quotation will appear here</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{service ? "The route and service are selected. Request a current courier price when you are ready." : "Complete the pickup contact and select a courier service to see the delivery fee."}</p></div>
          <Button className={`h-11 w-full ${primaryClass}`} disabled={busy || !canQuote} onClick={onQuote}>{quoting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CreditCard className="size-4" aria-hidden="true" />}{quoting ? "Requesting quotation…" : "Get quotation"}</Button>
        </>}
      </>}
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />The company pays the courier fee. Merchandise cash collection is not included. A quotation creates no booking until you confirm.</p>
    </CardContent>
  </Card>;
}
