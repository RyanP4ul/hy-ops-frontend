import { Suspense } from "react";
import { ModalProvider } from "@/components/providers/modal-provider";
import InventoryPage from "./components/inventory-page";
import { InventoryProvider } from "./provider";
import DialogPage from "./components/dialog";
import { MotionPage } from "@/components/page-motion";
import { Boxes } from "lucide-react";

export default function Page() { return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Loading inventory…</p>}><PageContent /></Suspense>; }

function PageContent() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <ModalProvider>
        <InventoryProvider>
          <section className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background text-primary"><Boxes className="size-5" aria-hidden="true" /></div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Inventory</h1>
                <p className="text-muted-foreground text-sm">Track stock levels, reservations, and movements across warehouses.</p>
              </div>
            </div>
            <DialogPage />
            <InventoryPage />
          </section>
        </InventoryProvider>
      </ModalProvider>
    </MotionPage>
  );
}
