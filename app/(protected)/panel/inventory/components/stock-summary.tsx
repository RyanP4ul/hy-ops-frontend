"use client";

import { useQuery } from "@tanstack/react-query";
import { useInventory } from "../provider";
import { Button } from "@/components/ui/button";

type Summary = { skus: number; low: number; out: number; reserved: number; available: number; threshold: number };

export function StockSummary() {
  const { warehouseId, setStockStatus, setPagination, setSearchQuery, setDateRange } = useInventory();
  const summary = useQuery<Summary>({
    queryKey: ["inventory-summary", warehouseId],
    queryFn: async () => {
      const response = await fetch(`/api/inventory/summary${warehouseId ? `?warehouse_id=${warehouseId}` : ""}`);
      if (!response.ok) throw new Error("Stock summary unavailable");
      return response.json();
    },
    refetchInterval: 30_000,
  });
  const filter = (status: "Low" | "Out") => {
    setStockStatus(status);
    setSearchQuery("");
    setDateRange(undefined);
    setPagination((page) => ({ ...page, pageIndex: 0 }));
  };
  return (
    <div className="space-y-2 px-6" aria-label="Stock summary">
      <p className="text-sm text-muted-foreground">
        {warehouseId ? "Selected warehouse" : "All warehouses"} · Available = on hand − reserved. Summary covers all stock in this scope.
      </p>
      {summary.isError ? <div role="alert" className="flex items-center gap-3 text-sm">Stock summary unavailable. <Button variant="outline" size="sm" onClick={() => void summary.refetch()}>Retry</Button></div> : (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-busy={summary.isFetching}>
          {([
            ["SKUs", "skus"], ["Low stock", "low"], ["Out of stock", "out"], ["Reserved units", "reserved"], ["Available units", "available"],
          ] as const).map(([label, key]) => (
            <div key={key} className="rounded-lg border p-3">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-xl font-semibold">{summary.data?.[key]?.toLocaleString() ?? "—"}</dd>
              {(key === "low" || key === "out") && <dd><Button variant="link" size="sm" className="h-auto p-0" onClick={() => filter(key === "low" ? "Low" : "Out")}>View items</Button></dd>}
            </div>
          ))}
        </dl>
      )}
      {summary.data && <p className="text-xs text-muted-foreground">Low stock: 1–{summary.data.threshold} available units per SKU and warehouse. Out of stock: no available units.</p>}
    </div>
  );
}
