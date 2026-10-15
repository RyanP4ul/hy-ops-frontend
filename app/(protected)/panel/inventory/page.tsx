import { ModalProvider } from "@/components/providers/modal-provider";
import { Metadata } from "next";
import InventoryPage from "./components/inventory-page";
import { InventoryProvider } from "./provider";
import DialogPage from "./components/dialog";
import StatCards from "./components/stat-cards";

export default function Page() {
  return (
    <div className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <InventoryProvider>
        <ModalProvider>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-3xl tracking-tight">Inventory</h2>
              <p className="text-muted-foreground text-sm">
                Keep tabs on lead quality, open opportunities, and conversion
                rates across the current sales cycle.
              </p>
            </div>
            <StatCards />
            <DialogPage />
            <InventoryPage />
          </section>
        </ModalProvider>
      </InventoryProvider>
    </div>
  );
}
