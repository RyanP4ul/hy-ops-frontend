"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_LOW_STOCK } from "./constants";
import { useFilterOptions } from "./hooks/use-filter-options";
import { useReportFilters } from "./hooks/use-report-filters";
import { CustomerOrdersSheet } from "./components/dialogs/customer-orders-sheet";
import { GenerateReportDialog } from "./components/dialogs/generate-report-dialog";
import { CustomersTab } from "./components/tabs/customers-tab";
import { DeliveriesTab } from "./components/tabs/deliveries-tab";
import { InventoryTab } from "./components/tabs/inventory-tab";
import { OverviewTab } from "./components/tabs/overview-tab";
import { PaymentsTab } from "./components/tabs/payments-tab";
import { SalesTab } from "./components/tabs/sales-tab";
import { FilterBar } from "./components/toolbar/filter-bar";
import { ReportToolbar } from "./components/toolbar/report-toolbar";

const TABS = [
  "overview",
  "sales",
  "inventory",
  "payments",
  "deliveries",
  "customers",
] as const;

/**
 * Page shell: owns the filters and cross-tab UI state. Each tab fetches its own data from /api/reports/<tab>
 * when it becomes active, so only the visible report is queried.
 */
export default function Page() {
  const { filters, ready, patch, setList, reset } = useReportFilters();
  const options = useFilterOptions();
  const [refreshKey, setRefreshKey] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [customer, setCustomer] = useState<{ id: number; name: string } | null>(
    null,
  );
  const [lowStock, setLowStock] = useState(DEFAULT_LOW_STOCK);

  if (!ready) return null; // wait for the URL filters so the first request already uses them
  const tab = { filters, refreshKey };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analysis &amp; Reports</h1>
          <p className="text-sm text-muted-foreground">
            Analyze sales, inventory, payments, deliveries, and customer
            performance.
          </p>
        </div>
        <ReportToolbar
          filters={filters}
          onChange={patch}
          onReset={reset}
          onRefresh={() => setRefreshKey((k) => k + 1)}
          onGenerate={() => setReportOpen(true)}
        />
      </div>

      <FilterBar
        filters={filters}
        options={options}
        onList={setList}
        onOverdueOnly={(overdueOnly) => patch({ overdueOnly })}
      />

      <Tabs defaultValue={TABS.find(value => value === new URLSearchParams(window.location.search).get("tab")) ?? "overview"} className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab {...tab} />
        </TabsContent>
        <TabsContent value="sales">
          <SalesTab {...tab} />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryTab
            {...tab}
            threshold={lowStock}
            onThresholdChange={setLowStock}
          />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab {...tab} />
        </TabsContent>
        <TabsContent value="deliveries">
          <DeliveriesTab {...tab} />
        </TabsContent>
        <TabsContent value="customers">
          <CustomersTab {...tab} onSelect={setCustomer} />
        </TabsContent>
      </Tabs>

      <GenerateReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        filters={filters}
        lowStockThreshold={lowStock}
      />
      <CustomerOrdersSheet
        customer={customer}
        filters={filters}
        onClose={() => setCustomer(null)}
      />
    </div>
  );
}
