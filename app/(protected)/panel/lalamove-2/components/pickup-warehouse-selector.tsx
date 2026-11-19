"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Check, Loader2, Save } from "lucide-react";
import { PaginatedCombobox } from "@/components/paginated-combobox";
import { Button } from "@/components/ui/button";
import { api } from "../lib/api";
import type { PickupWarehouse } from "../types";

export type PickupFeedback = { kind: "success" | "error"; message: string } | null;
export function warehouseAddress(warehouse: PickupWarehouse) {
  return [warehouse.street_address, warehouse.city, warehouse.state, warehouse.zip_code].filter(Boolean).join(", ");
}

export function PickupWarehouseSelector({ orderId, warehouse, locked, busy, saving, feedback, onSave }: {
  orderId: number; warehouse: PickupWarehouse; locked: boolean; busy: boolean; saving: boolean;
  feedback: PickupFeedback; onSave: (id: number) => void;
}) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PickupWarehouse | null>(warehouse);
  const query = useQuery({
    queryKey: ["lalamove", "pickup-warehouses", orderId, page, search],
    queryFn: () => api<{ rows: PickupWarehouse[]; total: number }>("GET", `/context/${orderId}/warehouses?page=${page}&search=${encodeURIComponent(search)}`),
    enabled: !locked,
  });
  // Use refreshed saved details when no different warehouse is being previewed.
  const preview = selected?.id === warehouse.id ? warehouse : selected;
  const missingPhone = !preview?.phone_number?.trim();
  return <div className="space-y-4">
    <p className="text-xs leading-relaxed text-muted-foreground">Choose a saved warehouse. Its name, address and phone number are used as the courier pickup contact. The stock warehouse for this order stays the same.</p>
    <form aria-label="Warehouse pickup contact" aria-busy={saving} className="space-y-4" onSubmit={event => { event.preventDefault(); if (selected) onSave(selected.id); }}>
      <PaginatedCombobox<PickupWarehouse>
        id="lalamove-pickup-warehouse" label="Pickup warehouse" value={selected ? String(selected.id) : null}
        selectedLabel={preview?.name || ""} options={query.data?.rows || []} getOptionValue={item => String(item.id)}
        renderOption={item => <div className="min-w-0 py-1"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground break-words">{warehouseAddress(item)}</p><p className="text-xs text-muted-foreground">{item.phone_number || "Phone number required"}</p></div>}
        onValueChange={(_value, option) => setSelected(option)} onSearchChange={setSearch}
        page={page} totalPages={Math.ceil((query.data?.total || 0) / 10)} onPageChange={setPage}
        isLoading={query.isFetching} disabled={busy || locked} required placeholder="Search saved warehouses…" emptyMessage="No matching active warehouses."
        error={query.error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{query.error.message}</p><Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>Retry warehouses</Button></div> : undefined}
      />
      {preview && <dl className="space-y-3 rounded-lg bg-muted/40 p-3 text-sm"><div><dt className="text-xs text-muted-foreground">Pickup contact</dt><dd className="mt-1 break-words font-medium">{preview.name}</dd></div><div><dt className="text-xs text-muted-foreground">Pickup address</dt><dd className="mt-1 break-words">{warehouseAddress(preview) || "Address required"}</dd></div><div><dt className="text-xs text-muted-foreground">Warehouse phone number</dt><dd className="mt-1">{preview.phone_number || "Not saved"}</dd></div></dl>}
      {missingPhone && <p role="status" className="text-xs text-amber-800 dark:text-amber-300">Add the warehouse phone number in <Link href="/panel/warehouses" className="underline underline-offset-2">Warehouses</Link> before requesting a courier.</p>}
      {locked ? <p className="text-xs text-muted-foreground">Pickup selection is locked while the order is scheduled or has an unresolved booking.</p> : <Button type="submit" variant="outline" disabled={busy || !selected || missingPhone || selected.id === warehouse.id}>{saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}{saving ? "Saving pickup warehouse…" : "Save pickup warehouse"}</Button>}
    </form>
    {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-lg p-3 text-sm ${feedback.kind === "error" ? "bg-destructive/5 text-destructive" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>{feedback.kind === "success" && <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}{feedback.message}</p>}
    <p className="text-[11px] leading-relaxed text-muted-foreground">Saving a different pickup warehouse clears the current quotation. Existing bookings retain their original pickup details. Edit saved warehouse details in <Link href="/panel/warehouses" className="underline underline-offset-2">Warehouses</Link>.</p>
  </div>;
}
