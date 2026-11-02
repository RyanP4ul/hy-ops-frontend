"use client";

import { Suspense } from "react";
import { ModalProvider } from "@/components/providers/modal-provider";
import { DeliveriesProvider } from "./provider";
import DeliveriesPage from "./components/deliveries-page";
import DeliveriesDialog from "./components/dialog";
import { MotionPage } from "@/components/page-motion";

export default function Page() { return <Suspense fallback={<p role="status">Loading records?</p>}><PageContent /></Suspense>; }

function PageContent() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <DeliveriesProvider>
        <ModalProvider>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-3xl tracking-tight">Deliveries</h2>
              <p className="text-muted-foreground text-sm">
                Manage delivery status, assignments, and delivery events.
              </p>
            </div>
            <DeliveriesDialog />
            <DeliveriesPage />
          </section>
        </ModalProvider>
      </DeliveriesProvider>
    </MotionPage>
  );
}
