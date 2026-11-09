"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, ClipboardList, History, Radio, RefreshCw, Settings2, Truck, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "./lib/api";
import { BookingCard } from "./components/booking-card";
import { DeliveryDetails, QuotePanel, ServicePanel } from "./components/order-panels";
import { Overview } from "./components/overview";
import { dateLabel, ListSkeleton, QueryError, SectionHeading, words } from "./components/presentation";
import type { Booking, City, Context, Quotation, ReadyOrder, Reconciliation, Setup } from "./types";

export function OrderWorkspace() {
  const params = useSearchParams();
  const value = Number(params.get("orderId"));
  const orderId = Number.isSafeInteger(value) && value > 0 ? value : 0;
  return <Workspace key={orderId} orderId={orderId} />;
}

function Workspace({ orderId }: { orderId: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const view = ["history", "settings"].includes(params.get("view") || "") ? params.get("view") || "overview" : "overview";
  const filter = ["active", "review", "completed"].includes(params.get("filter") || "") ? params.get("filter") || "all" : "all";
  const search = (params.get("q") || "").trim();
  const pageValue = Number(params.get("page"));
  const historyPage = Number.isSafeInteger(pageValue) && pageValue >= 0 && pageValue <= 10000 ? pageValue : 0;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickupSaving, setPickupSaving] = useState(false);
  const [pickupFeedback, setPickupFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);
  const [city, setCity] = useState("");
  const [service, setService] = useState("");
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [packageConfirmed, setPackageConfirmed] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const confirmation = useRef<{ quote: string; key: string } | null>(null);
  const quotePanel = useRef<HTMLElement>(null);

  const context = useQuery({ queryKey: ["lalamove", "context", orderId], queryFn: () => api<Context>("GET", `/context/${orderId}`), enabled: orderId > 0, refetchInterval: 15000 });
  const eligible = useQuery({ queryKey: ["lalamove", "eligible"], queryFn: () => api<ReadyOrder[]>("GET", "/eligible"), enabled: !orderId });
  const bookings = useQuery({ queryKey: ["lalamove", "history", historyPage], queryFn: () => api<Booking[]>("GET", `/orders?page=${historyPage}`), enabled: !orderId, refetchInterval: 30000 });
  const queue = useQuery({ queryKey: ["lalamove", "reconciliation"], queryFn: () => api<Reconciliation>("GET", "/reconciliation"), enabled: !orderId, refetchInterval: 60000 });
  const setup = useQuery({ queryKey: ["lalamove", "setup"], queryFn: () => api<Setup>("GET", "/setup"), enabled: !orderId, refetchInterval: 30000 });
  const cities = useQuery({ queryKey: ["lalamove", "cities"], queryFn: () => api<{ data: City[] }>("GET", "/cities"), enabled: Boolean(context.data?.enabled), staleTime: 300000 });

  useEffect(() => {
    if (!orderId) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [orderId]);

  const data = context.data;
  const active = data?.bookings.some(attempt => attempt.active) || false;
  const primaryBooking = data?.bookings.find(attempt => attempt.active) || data?.bookings.find(attempt => attempt.status === "COMPLETED") || null;
  const services = cities.data?.data?.find(item => item.locode === city)?.services || [];
  const chosenService = services.find(item => item.key === service);
  const environment = data?.environment || setup.data?.environment;
  const updatedAt = orderId ? context.dataUpdatedAt : Math.max(eligible.dataUpdatedAt, bookings.dataUpdatedAt);
  const step = primaryBooking ? 2 : quote ? 1 : 0;

  function updateUrl(values: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.replace(`/panel/lalamove${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  function viewHref(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "overview") next.delete("view");
    else next.set("view", value);
    return `/panel/lalamove${next.size ? `?${next}` : ""}`;
  }

  async function action(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await Promise.all([client.invalidateQueries({ queryKey: ["lalamove"] }), client.invalidateQueries({ queryKey: ["order"] })]);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete operation.");
      return false;
    } finally { setBusy(false); }
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
      const result = await api<{ message: string }>("PUT", `/context/${orderId}/warehouse`, {
        warehouse_id: warehouseId, version: data.order.version,
      });
      invalidateQuote();
      setPickupFeedback({ kind: "success", message: result.message || "Pickup warehouse saved." });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["lalamove"] }),
        client.invalidateQueries({ queryKey: ["warehouses"] }),
        client.invalidateQueries({ queryKey: ["warehouse_detail"] }),
      ]);
    } catch (cause) {
      setPickupFeedback({ kind: "error", message: cause instanceof Error ? cause.message : "Unable to save the pickup warehouse. Please try again." });
    } finally { setPickupSaving(false); setBusy(false); }
  }

  async function requestQuotation() {
    if (!data) return;
    setQuoting(true);
    try {
      const success = await action(async () => {
        invalidateQuote();
        setQuote(await api<Quotation>("POST", "/quotations", { order_id: orderId, order_version: data.order.version, service_type: service, city }));
      });
      if (success) requestAnimationFrame(() => {
        quotePanel.current?.querySelector("h2")?.focus({ preventScroll: true });
        if (window.matchMedia("(max-width: 1023px)").matches) quotePanel.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      });
    } finally { setQuoting(false); }
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
        await api("POST", "/orders", { order_id: orderId, order_version: data.order.version, quotation_ref: quote.quotation_ref, idempotency_key: key, package_confirmed: packageConfirmed });
        setQuote(null);
      });
      // Reload the durable attempt even when the browser response is uncertain.
      await context.refetch();
    } finally { setBooking(false); }
  }

  return <main className="mx-auto w-full space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
    <header className="space-y-5">
      <Link href={orderId ? "/panel/lalamove" : "/panel/deliveries"} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />{orderId ? "All Lalamove deliveries" : "Back to deliveries"}</Link>
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-900 dark:bg-orange-950/40"><Truck className="size-6" aria-hidden="true" /></span><div><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-700 dark:text-orange-400">Delivery workspace</span>{environment && <Badge variant="outline" className="px-1.5 py-0 text-[10px] capitalize">{environment}</Badge>}</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{orderId ? data?.order.order_number || "Prepare courier delivery" : "Lalamove deliveries"}</h1><p className="mt-1.5 text-sm text-muted-foreground">{orderId ? "Review the route and courier fee before confirming a booking." : "Book ready orders and follow your courier deliveries in one place."}</p></div></div><div className="space-y-2 sm:text-right"><Button type="button" variant="outline" size="sm" disabled={orderId ? context.isFetching : bookings.isFetching || eligible.isFetching} onClick={() => { if (orderId) void context.refetch(); else { void bookings.refetch(); void eligible.refetch(); } }}><RefreshCw className={`size-3.5 ${(orderId ? context.isFetching : bookings.isFetching) ? "animate-spin" : ""}`} aria-hidden="true" />Refresh page</Button>{updatedAt > 0 && <p className="text-[10px] text-muted-foreground">Updated {dateLabel(new Date(updatedAt).toISOString())} · Manila</p>}</div></div>
      {!orderId && <nav aria-label="Delivery workspace" className="flex flex-wrap gap-1 border-b">{[{ value: "overview", label: "Ready to book", icon: ClipboardList }, { value: "history", label: "Booking history", icon: History }, ...(setup.data?.can_manage ? [{ value: "settings", label: "Settings", icon: Settings2 }] : [])].map(item => <Link key={item.value} href={viewHref(item.value)} aria-current={view === item.value ? "page" : undefined} className={cn("inline-flex items-center gap-1.5 border-b-2 px-2 py-3 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm", view === item.value ? "border-orange-600 text-orange-700 dark:text-orange-400" : "border-transparent text-muted-foreground hover:text-foreground")}><item.icon className="size-4" aria-hidden="true" />{item.label}</Link>)}</nav>}
      {orderId > 0 && data && <ol aria-label="Booking steps" className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-3 sm:p-4">{["Delivery details", "Review quotation", "Courier booking"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className="flex items-center gap-2 text-xs"><span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold", index < step ? "border-emerald-600 bg-emerald-600 text-white" : index === step ? "border-orange-600 bg-orange-600 text-white" : "border-border bg-muted/40 text-muted-foreground")}>{index < step ? <Check className="size-3" aria-hidden="true" /> : index + 1}</span><span className={index === step ? "font-semibold" : "text-muted-foreground"}>{label}</span></li>)}</ol>}
    </header>

    {error && <Alert variant="destructive"><AlertTitle>Unable to continue</AlertTitle><AlertDescription className="flex items-start justify-between gap-3"><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError(null)} className="rounded p-1 hover:bg-destructive/10"><X className="size-3.5" /></button></AlertDescription></Alert>}
    {notice && <Alert><AlertTitle>Configuration updated</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}

    {!orderId ? <Overview view={view} filter={filter} search={search} page={historyPage} busy={busy} ready={eligible} bookings={bookings} setup={setup} queue={queue} action={action} setNotice={setNotice} updateUrl={updateUrl} /> : <>
      {context.error && <QueryError message={context.error.message} retry={() => void context.refetch()} />}
      {context.isPending ? <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><ListSkeleton label="delivery details" /><ListSkeleton label="courier quotation" /></div> : data && <>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0 space-y-5">
            <DeliveryDetails key={data.warehouse.id} data={data} busy={busy} saving={pickupSaving} feedback={pickupFeedback} onSave={id => void savePickupWarehouse(id)} onMethod={method => void action(async () => { await api("PUT", `/context/${orderId}/method`, { version: data.order.version, method }); invalidateQuote(); })} />
            {!active && data.order.delivery_method === "LALAMOVE" && !primaryBooking && <ServicePanel cities={cities.data?.data || []} city={city} service={service} disabled={busy || !data.enabled} loading={cities.isFetching && !cities.data} error={cities.error?.message} onCity={value => { setCity(value); setService(""); invalidateQuote(); }} onService={value => { setService(value); invalidateQuote(); }} retry={() => void cities.refetch()} />}
            <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground"><Radio className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Status updates refresh automatically. Provider polling normally takes 2–3 minutes; Refresh status checks the courier sooner.</p>
          </div>
          <aside ref={quotePanel} aria-label={primaryBooking ? "Current courier booking" : "Quotation and booking confirmation"} className="min-w-0 scroll-mt-4 lg:sticky lg:top-6">{primaryBooking ? <BookingCard booking={primaryBooking} busy={busy} action={action} canReconcile={data.can_reconcile} now={clock} /> : <QuotePanel data={data} quote={quote} service={chosenService} now={clock} busy={busy} quoting={quoting} booking={booking} confirmed={packageConfirmed} onConfirmed={setPackageConfirmed} onQuote={() => void requestQuotation()} onBook={() => void confirmBooking()} />}</aside>
        </div>
        {!!data.bookings.filter(attempt => attempt.id !== primaryBooking?.id).length && <details className="group space-y-4 rounded-xl border bg-muted/10 p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium"><span>Previous booking attempts <span className="ml-1 text-muted-foreground">({data.bookings.filter(attempt => attempt.id !== primaryBooking?.id).length})</span></span><ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.bookings.filter(attempt => attempt.id !== primaryBooking?.id).map(attempt => <BookingCard key={attempt.id} booking={attempt} busy={busy} action={action} canReconcile={data.can_reconcile} now={clock} />)}</div></details>}
        {!!data.history.length && <Card><CardContent className="space-y-4 pt-1"><SectionHeading title="Delivery activity" description="Recent provider updates and synchronization history · Manila time" /><ol className="divide-y">{data.history.map(event => <li key={event.id} className="flex gap-3 py-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/35" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{event.event_type === "HYOPS_PROVIDER_SYNC" ? "Delivery details updated" : words(event.event_type)}</p>{event.last_error && <p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-400">{event.last_error}</p>}<p className="mt-1 text-[11px] text-muted-foreground">{dateLabel(event.created_at)} · {words(event.state)}</p></div></li>)}</ol></CardContent></Card>}
      </>}
    </>}
  </main>;
}
