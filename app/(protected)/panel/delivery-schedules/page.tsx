"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import { DeliveryScheduleProvider } from "./provider";
import DeliverySchedulePage from "./components/delivery-schedule-page";
import DeliveryScheduleDialog from "./components/dialog";
import SubDialog from "./components/sub-modal";
import { MotionPage } from "@/components/page-motion";
import { ManagementPageHeading } from "@/components/management-list";
import { CalendarDays } from "lucide-react";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <DeliveryScheduleProvider>
        <ModalProvider>
          <section className="space-y-5">
            <ManagementPageHeading title="Delivery schedules" description="Review ready orders, confirm destinations, and plan your next dispatch." icon={<CalendarDays className="size-5" />} />
            <DeliveryScheduleDialog />
            <DeliverySchedulePage />
          </section>
        </ModalProvider>
        <SubDialog />
      </DeliveryScheduleProvider>
    </MotionPage>
  );
}
