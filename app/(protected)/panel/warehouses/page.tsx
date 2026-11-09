"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import { WarehousesProvider } from "./provider";
import WarehouseDialog from "./components/dialog";
import WarehousePage from "./components/warehouse-page";
import { MotionPage } from "@/components/page-motion";
import { Warehouse } from "lucide-react";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <ModalProvider>
        <WarehousesProvider>
          <section className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background text-primary"><Warehouse className="size-5" aria-hidden="true" /></div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Warehouses</h1>
                <p className="text-muted-foreground text-sm">Manage your locations and keep pickup and delivery addresses accurate.</p>
              </div>
            </div>
            <WarehouseDialog />
            <WarehousePage />
          </section>
        </WarehousesProvider>
      </ModalProvider>
    </MotionPage>
  );
}
