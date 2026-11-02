import { Suspense } from "react";
import { ModalProvider } from "@/components/providers/modal-provider";
import InventoryPage from "./components/inventory-page";
import { InventoryProvider } from "./provider";
import DialogPage from "./components/dialog";
import { MotionPage } from "@/components/page-motion";

export default function Page() { return <Suspense fallback={<p role="status">Loading records?</p>}><PageContent /></Suspense>; }

function PageContent() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <ModalProvider>
        <InventoryProvider>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-3xl tracking-tight">Inventory</h2>
              <p className="text-muted-foreground text-sm">
                Track stock levels, reservations, and movements across warehouses.
              </p>
            </div>
            <DialogPage />
            <InventoryPage />
          </section>
        </InventoryProvider>
      </ModalProvider>
    </MotionPage>
  );
}
