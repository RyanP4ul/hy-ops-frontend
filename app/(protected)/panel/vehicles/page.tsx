"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import { VehiclesProvider } from "./provider";
import VehicleDialog from "./components/dialog";
import VehiclePage from "./components/vehicle-page";
import { MotionPage } from "@/components/page-motion";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 lg:px-6">
      <ModalProvider>
        <VehiclesProvider>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-3xl tracking-tight">Vehicles</h2>
              <p className="text-muted-foreground text-sm">
                View, add, and update your delivery fleet. Keep track of each
                vehicle details and availability to ensure smooth
                dispatching.
              </p>
            </div>
            <VehicleDialog />
            <VehiclePage />
          </section>
        </VehiclesProvider>
      </ModalProvider>
    </MotionPage>
  );
}
