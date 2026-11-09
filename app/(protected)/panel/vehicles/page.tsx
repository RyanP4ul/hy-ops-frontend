"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import { VehiclesProvider } from "./provider";
import VehicleDialog from "./components/dialog";
import VehiclePage from "./components/vehicle-page";
import { MotionPage } from "@/components/page-motion";
import { ManagementPageHeading } from "@/components/management-list";
import { Truck } from "lucide-react";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 lg:px-6">
      <ModalProvider>
        <VehiclesProvider>
          <section className="space-y-5">
            <ManagementPageHeading title="Vehicles" description="Manage your fleet, assigned warehouses, and vehicle availability." icon={<Truck className="size-5" />} />
            <VehicleDialog />
            <VehiclePage />
          </section>
        </VehiclesProvider>
      </ModalProvider>
    </MotionPage>
  );
}
