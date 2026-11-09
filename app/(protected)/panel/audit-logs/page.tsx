"use client";

import { AuditLogsProvider } from "./provider";
import { DataTable } from "./components/data-table";
import { MotionPage } from "@/components/page-motion";
import { ShieldCheck } from "lucide-react";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <AuditLogsProvider>
        <section className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Audit logs</h1>
              <p className="text-muted-foreground text-sm">
                See what changed, who made the change, and when it happened.
              </p>
            </div>
          </div>
          <DataTable />
        </section>
      </AuditLogsProvider>
    </MotionPage>
  );
}
