"use client";

import { AuditLogsProvider } from "./provider";
import { DataTable } from "./components/data-table";

export default function Page() {
  return (
    <div className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <AuditLogsProvider>
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-3xl tracking-tight">Audit Logs</h2>
            <p className="text-muted-foreground text-sm">
              Monitor user activities and system changes.
            </p>
          </div>
          <DataTable />
        </section>
      </AuditLogsProvider>
    </div>
  );
}
