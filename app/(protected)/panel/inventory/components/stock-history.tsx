"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/components/http";
import { QueryFeedback } from "@/components/query-feedback";
type Movement = { id: number; kind: string; quantity_delta: number; reserved_delta: number; quantity_after: number; reserved_after: number; reason: string; actor: string | null; created_at: string };
export function StockHistory({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const query = useQuery<Movement[]>({ queryKey: ["stock-history", id], enabled: open, queryFn: async () => {
    const response = await request("GET", `/api/inventory/${id}/movements`);
    if (!response.ok) throw new Error("Unable to load stock history.");
    return response.json();
  } });
  return <details onToggle={(event) => setOpen(event.currentTarget.open)} className="min-w-48">
    <summary className="cursor-pointer text-sm underline">Movement history</summary>
    <div className="max-h-72 space-y-2 overflow-auto py-2"><QueryFeedback query={query} label="stock history" />
      {query.isPending && <p role="status">Loading...</p>}
      {query.data?.length === 0 && <p className="text-xs text-muted-foreground">No recorded movements. Earlier changes may predate movement tracking.</p>}
      {query.data?.map((move) => <div key={move.id} className="border-b py-2 text-xs">
        <p className="font-medium">{move.kind}: on hand {move.quantity_delta > 0 ? "+" : ""}{move.quantity_delta}, reserved {move.reserved_delta > 0 ? "+" : ""}{move.reserved_delta}</p>
        <p>{move.reason}</p><p className="text-muted-foreground">Balance {move.quantity_after}; reserved {move.reserved_after} · {move.actor ?? "Order workflow"} · {new Date(move.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
      </div>)}
    </div>
  </details>;
}
