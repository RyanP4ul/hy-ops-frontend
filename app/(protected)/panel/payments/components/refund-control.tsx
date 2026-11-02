"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/components/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QueryFeedback } from "@/components/query-feedback";
import { formatCurrency } from "@/utils/date-util";
import type { PaymentRowType } from "@/schema/payment";
type Refund = { id: number; amount: string; reason: string; actor: string; created_at: string };

export function RefundControl({ payment }: { payment: PaymentRowType }) {
  const [open, setOpen] = useState(false), [amount, setAmount] = useState(""), [reason, setReason] = useState(""), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const [locked, setLocked] = useState(false);
  const requestId = useRef<string | null>(null);
  const submitted = useRef<{ amount: number; reason: string; version: number } | null>(null);
  const client = useQueryClient();
  const verifiedNet = payment.amount != null && Number.isFinite(Number(payment.amount)) && Number(payment.amount) >= 0;
  const history = useQuery<Refund[]>({ queryKey: ["payment-refunds", payment.payment_number], enabled: open, queryFn: async () => {
    const response = await request("GET", `/api/payments/${encodeURIComponent(payment.payment_number)}/refunds`);
    if (!response.ok) throw new Error("Unable to load refund history."); return response.json();
  } });
  async function record() {
    if (saving) return;
    if (!submitted.current && (!verifiedNet || !reason.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > Number(payment.amount))) { setMessage("Enter a positive amount within the net received balance and a reason."); return; }
    if (!requestId.current) requestId.current = crypto.randomUUID();
    if (!submitted.current) submitted.current = { amount: Number(amount), reason: reason.trim(), version: payment.version };
    setLocked(true); setSaving(true); setMessage("");
    try {
      const response = await request("POST", "/api/payments/refunds", { payment_number: payment.payment_number, ...submitted.current, request_id: requestId.current });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) {
          requestId.current = null; submitted.current = null; setLocked(false);
          void client.invalidateQueries({ queryKey: ["payments"] });
        }
        throw new Error(result.message || "Unable to confirm refund. Refresh and retry the same request.");
      }
      requestId.current = null; submitted.current = null; setLocked(false); setAmount(""); setReason(""); setMessage(result.message);
      await client.invalidateQueries({ predicate: (query) => ["payments", "payment-refunds", "invoice", "reports", "dashboard_query", "fleet", "orders"].includes(String(query.queryKey[0])) });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to confirm refund. Retry the same request."); }
    finally { setSaving(false); }
  }
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>Refund / history</PopoverTrigger>
    <PopoverContent className="w-80 space-y-3">
      <p className="font-medium">Record a refund</p>
      <p className="text-xs text-muted-foreground">Received {formatCurrency(payment.gross_received)} · refunded {formatCurrency(payment.refunded_amount)} · net {formatCurrency(payment.amount)}. Record money already returned; stock is adjusted separately.</p>
      <Label htmlFor={`refund-amount-${payment.id}`}>Refund amount</Label><Input id={`refund-amount-${payment.id}`} type="number" min={0.01} step={0.01} max={verifiedNet ? Number(payment.amount) : undefined} disabled={saving || !!locked} value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Label htmlFor={`refund-reason-${payment.id}`}>Reason</Label><Input id={`refund-reason-${payment.id}`} maxLength={500} disabled={saving || !!locked} value={reason} onChange={(event) => setReason(event.target.value)} />
      <Button type="button" disabled={saving || (!locked && (!verifiedNet || Number(payment.amount) <= 0 || !amount || !reason.trim()))} onClick={() => void record()}>{saving ? "Recording..." : locked ? "Retry same refund" : "Record refund"}</Button>
      {message && <p role="status" className="text-sm">{message}</p>}
      <QueryFeedback query={history} label="refund history" />
      <div className="max-h-48 overflow-auto text-xs">{history.data?.length === 0 && <p>No refunds recorded.</p>}{history.data?.map((refund) => <div key={refund.id} className="border-t py-2"><p>{formatCurrency(refund.amount)} · {refund.reason}</p><p>{refund.actor} · {new Date(refund.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p></div>)}</div>
    </PopoverContent>
  </Popover>;
}
