"use client";

import { DataTable } from "./data-table";
import { StockTools } from "./stock-tools";
import { StockSummary } from "./stock-summary";

export default function InventoryPage() {
  return (
    <div className="space-y-5">
      <StockSummary />
      <DataTable />
      <StockTools />
    </div>
  );
}
