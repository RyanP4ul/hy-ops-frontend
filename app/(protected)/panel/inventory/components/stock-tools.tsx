"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/components/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryFeedback } from "@/components/query-feedback";
import { useAuth } from "@/components/providers/auth-provider";
import { useInventory } from "../provider";
type Plan = { token: string; legacyOrders: number; issues: string[]; rows: { id: number; sku: string; warehouse: string; quantity: number; current_reserved: number; expected_reserved: number }[] };
export function StockTools() {
  const { warehouseId } = useInventory();
  const { userQuery } = useAuth();
  const role = userQuery.data?.role;
  const [open, setOpen] = useState(false), [reason, setReason] = useState(""), [message, setMessage] = useState(""), [saving, setSaving] = useState(false);
  const client = useQueryClient();
  const suggestions = useQuery<{ threshold: number; rows: { id: number; sku: string; warehouse: string; available: number; suggested: number; unit: string }[] }>({ queryKey: ["inventory-reorder", warehouseId], queryFn: async () => {
    const response = await request("GET", `/api/inventory/reorder${warehouseId ? `?warehouse_id=${warehouseId}` : ""}`);
    if (!response.ok) throw new Error("Unable to load replenishment suggestions."); return response.json();
  } });
  const preview = useQuery<Plan>({ queryKey: ["inventory-reconciliation"], enabled: open && role === "admin", queryFn: async () => {
    const response = await request("GET", "/api/inventory/reconciliation"); if (!response.ok) throw new Error("Unable to preview reservations."); return response.json();
  } });
  async function reconcile() {
    if (!preview.data || saving) return; setSaving(true); setMessage("");
    try {
      const response = await request("POST", "/api/inventory/reconciliation", { token: preview.data.token, reason });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || "Stock changed. Refresh the preview before retrying.");
      setMessage(result.message); setReason("");
      await client.invalidateQueries({ predicate: (query) => ["inventory", "inventory-summary", "inventory-reorder", "inventory-reconciliation", "stock-history", "orders"].includes(String(query.queryKey[0])) });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to reconcile stock."); }
    finally { setSaving(false); }
  }
  return <div className="space-y-3 px-4">
    <details><summary className="cursor-pointer font-medium">Replenishment suggestions</summary><QueryFeedback query={suggestions} label="suggestions" />
      <p className="py-2 text-xs text-muted-foreground">Suggested quantities restore availability above the low-stock threshold. Review these quantities before purchasing.</p>
      {suggestions.data?.rows.length === 0 && <p className="text-sm">No replenishment needed for this warehouse scope.</p>}
      <ul className="max-h-64 overflow-auto text-sm">{suggestions.data?.rows.map((row) => <li className="border-b py-2" key={row.id}>{row.sku} · {row.warehouse}: {row.available} available; suggested {row.suggested} {row.unit}</li>)}</ul>
    </details>
    {role === "admin" && <details onToggle={(event) => setOpen(event.currentTarget.open)}><summary className="cursor-pointer font-medium">Review legacy reservations</summary>
      <p className="py-2 text-xs text-muted-foreground">Across all warehouses. Review discrepancies, then confirm rebuilding reservations from active, undispatched orders. On-hand counts stay the same.</p>
      <QueryFeedback query={preview} label="reconciliation preview" />
      <Button className="my-2" type="button" variant="outline" size="sm" disabled={preview.isFetching || saving} onClick={() => { setMessage(""); void preview.refetch(); }}>Refresh preview</Button>
      {preview.data && <>
        <p className="text-sm">{preview.data.rows.filter(row => row.current_reserved !== row.expected_reserved).length} reservation discrepancies across {preview.data.rows.length} inventory records.</p>
        <p className="text-sm">{preview.data.legacyOrders} orders need reservation confirmation.</p>
        {preview.data.issues.map((issue) => <p className="text-sm text-destructive" key={issue}>{issue}</p>)}
        <ul className="max-h-48 overflow-auto text-sm">{preview.data.rows.filter((row) => row.current_reserved !== row.expected_reserved).map((row) => <li key={row.id}>{row.sku} at {row.warehouse} (inventory #{row.id}): reserved {row.current_reserved} → {row.expected_reserved} (on hand {row.quantity})</li>)}</ul>
        <Label htmlFor="reconciliation-reason">Reason for reconciliation</Label><Input id="reconciliation-reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        <Button className="mt-2" type="button" disabled={saving || preview.isFetching || preview.isError || !!preview.data.issues.length || !reason.trim()} onClick={() => void reconcile()}>{saving ? "Reconciling..." : "Confirm reconciliation"}</Button>
      </>}{message && <p role="status" className="py-2 text-sm">{message}</p>}
    </details>}
  </div>;
}
