"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import { WarehousesProvider } from "./provider";
import WarehouseDialog from "./components/dialog";
import DataTable from "./components/data-table";
import WarehousePage from "./components/warehouse-page";
import { MotionPage } from "@/components/page-motion";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <ModalProvider>
        <WarehousesProvider>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-3xl tracking-tight">Warehouses</h2>
              <p className="text-muted-foreground text-sm">
                Manage warehouse locations and delivery addresses.
              </p>
            </div>
            <WarehouseDialog />
            <WarehousePage />
          </section>
        </WarehousesProvider>
      </ModalProvider>
    </MotionPage>
  );
}
