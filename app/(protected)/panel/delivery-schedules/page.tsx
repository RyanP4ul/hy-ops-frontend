"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import { DeliveryScheduleProvider } from "./provider";
import DeliverySchedulePage from "./components/delivery-schedule-page";
import DeliveryScheduleDialog from "./components/dialog";
import SubDialog from "./components/sub-modal";
import { MotionPage } from "@/components/page-motion";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <DeliveryScheduleProvider>
        <ModalProvider>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-3xl tracking-tight">Delivery Schedules</h2>
              <p className="text-muted-foreground text-sm">
                Review delivery windows, assign drivers and vehicles, and manage
                dispatch readiness.
              </p>
            </div>
            <DeliveryScheduleDialog />
            <DeliverySchedulePage />
          </section>
        </ModalProvider>
        <SubDialog />
      </DeliveryScheduleProvider>
    </MotionPage>
  );
}
