"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, FileCheck2, Phone, ShieldAlert, Truck, UserRound, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Action, Booking } from "../types";
import { api } from "../lib/api";
import { BookingProgress, dateLabel, money, PendingIcon, primaryClass, StatusBadge, words } from "./presentation";

export function BookingCard({ booking, busy, action, canReconcile, now }: { booking: Booking; busy: boolean; action: Action; canReconcile: boolean; now: number }) {
  const [note, setNote] = useState("");
  const [providerId, setProviderId] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const needsReview = ["UNKNOWN", "REVIEW"].includes(booking.booking_state);
  const stale = !!booking.last_synced_at && now - Date.parse(booking.last_synced_at) > 300000 && booking.active;
  const canCancel = booking.active && !booking.picked_up_at && !!booking.lalamove_order_id;
  async function perform(kind: string, work: () => Promise<unknown>) {
    setPending(kind);
    try { if (await action(work)) setConfirmCancel(false); }
    finally { setPending(null); }
  }
  return <Card className={needsReview ? "ring-amber-300 dark:ring-amber-900" : ""}>
    <CardHeader className="gap-3">
      <div className="flex items-center justify-between gap-3"><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{booking.active ? "Current booking" : "Previous booking"} #{booking.id}</span><Badge variant="outline" className="capitalize">{booking.environment}</Badge></div>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><Truck className="size-4 text-orange-600" aria-hidden="true" />Courier delivery</h2><StatusBadge booking={booking} /></div>
    </CardHeader>
    <CardContent className="space-y-5">
      <BookingProgress booking={booking} />
      {(booking.failure_message || needsReview) && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p className="mb-1 flex items-center gap-2 font-medium"><ShieldAlert className="size-4" aria-hidden="true" />{needsReview ? "Review before booking again" : "Booking update"}</p>{booking.failure_message || "The courier confirmation needs to be checked. Keep this booking open and ask an administrator to review it."}</div>}
      <div className="flex items-end justify-between gap-4 rounded-xl bg-muted/40 p-4"><div><p className="text-xs text-muted-foreground">Courier cost</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{money(booking.delivery_fee, booking.currency)}</p></div><span className="pb-1 text-xs text-muted-foreground">Company pays</span></div>
      {booking.driver_details ? <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted"><UserRound className="size-4" aria-hidden="true" /></span><div className="min-w-0"><p className="text-sm font-medium">{booking.driver_details.name || "Assigned courier"}</p><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{booking.driver_details.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" aria-hidden="true" />{booking.driver_details.phone}</span>}{booking.driver_details.plateNumber && <span>{booking.driver_details.plateNumber}</span>}</div></div></div> : booking.active && <p className="text-sm text-muted-foreground">Courier details will appear after a driver is assigned.</p>}
      <div className="space-y-1"><p className="break-all text-xs text-muted-foreground">Lalamove reference: {booking.lalamove_order_id || "Awaiting reconciliation"}</p><p className={`text-xs ${stale ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{stale ? "Update delayed · " : "Last synchronized: "}{dateLabel(booking.last_synced_at)}{booking.last_synced_at ? " · Manila" : ""}</p></div>
      <div className="flex flex-wrap gap-2">
        {booking.share_link && <a href={booking.share_link} target="_blank" rel="noreferrer" className={cn(buttonVariants(), primaryClass)}><ExternalLink className="size-4" aria-hidden="true" />Open Lalamove tracking</a>}
        <Button variant="outline" disabled={busy || !booking.lalamove_order_id} onClick={() => void perform("refresh", () => api("POST", `/orders/${booking.id}/refresh`))}><PendingIcon pending={pending === "refresh"} />{pending === "refresh" ? "Checking status…" : "Refresh status"}</Button>
      </div>
      {!!booking.evidence?.length && <div className="space-y-2 border-t pt-3">{booking.evidence.map(proof => <p key={proof.stop_id} className="flex items-center gap-2 text-sm"><FileCheck2 className="size-4 text-emerald-600" aria-hidden="true" />Proof of delivery: {words(proof.status)}{proof.delivered_at && <span className="text-xs text-muted-foreground">{dateLabel(proof.delivered_at)}</span>}</p>)}</div>}
      {canCancel && !confirmCancel && <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" disabled={busy} onClick={() => setConfirmCancel(true)}><X className="size-3.5" aria-hidden="true" />Cancel courier</Button>}
      {canCancel && confirmCancel && <section aria-label="Confirm courier cancellation" className="space-y-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4"><p className="text-sm font-semibold">Cancel this courier booking?</p><p className="text-xs leading-relaxed text-muted-foreground">The sales order and merchandise payment remain open. Lalamove must accept the cancellation before the order can be booked again.</p><div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy} onClick={() => void perform("cancel", () => api("POST", `/orders/${booking.id}/cancel`))}>{pending === "cancel" ? "Cancelling…" : "Confirm cancellation"}</Button><Button variant="outline" disabled={busy} onClick={() => setConfirmCancel(false)}>Keep booking</Button></div></section>}
      {canReconcile && booking.active && needsReview && <details className="group border-t pt-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">Administrator reconciliation<ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><div className="mt-3 space-y-3"><p className="text-xs leading-relaxed text-muted-foreground">Check Partner Portal or support before releasing this attempt. Picked-up goods require custody review.</p><label className="block space-y-1.5 text-xs font-medium">Provider order ID, if found<Input aria-label="Provider order ID for reconciliation" value={providerId} onChange={event => setProviderId(event.target.value)} placeholder="Existing Lalamove order ID" /></label><label className="block space-y-1.5 text-xs font-medium">Evidence and resolution<Input aria-label="Reconciliation evidence" value={note} onChange={event => setNote(event.target.value)} placeholder="Record the Portal or support findings" /></label><p className="text-xs text-muted-foreground">Include at least 15 characters.</p><Button disabled={busy || note.trim().length < 15} onClick={() => void perform("reconcile", () => api("POST", `/orders/${booking.id}/reconcile`, { note, ...(providerId.trim() ? { provider_order_id: providerId.trim() } : {}) }))}>{pending === "reconcile" ? "Saving resolution…" : providerId.trim() ? "Link and synchronize booking" : "Confirm no active booking and release"}</Button></div></details>}
      {booking.status === "COMPLETED" && <p className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-3.5" aria-hidden="true" />Delivery completed. Merchandise payments remain managed in Orders.</p>}
    </CardContent>
  </Card>;
}
