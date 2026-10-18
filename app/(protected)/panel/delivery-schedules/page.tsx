"use client";

import { FileText, Plus, ShoppingCart, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalProvider, useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { DeliveryScheduleProvider } from "./provider";
import DeliverySchedulePage from "./components/delivery-schedule-page";
import DeliveryScheduleDialog from "./components/dialog";
import SubDialog from "./components/sub-modal";

export default function Page() {
  return (
    <div className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <DeliveryScheduleProvider>
        <ModalProvider>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-3xl tracking-tight">Orders</h2>
              <p className="text-muted-foreground text-sm">
                Manage customer orders, products, and delivery methods.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Awaiting Schedule
                  </p>
                  <ShoppingCart className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-2xl font-semibold">12</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  All recorded orders
                </p>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Scheduled Today
                  </p>
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-2xl font-semibold">₱ 1,234,567.89</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Based on mock product prices
                </p>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Available Trucks
                  </p>
                  <Truck className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-2xl font-semibold">2</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Orders using third-party delivery
                </p>
              </div>
            </div>
            <DeliveryScheduleDialog />
            <DeliverySchedulePage />
          </section>
        </ModalProvider>
        <SubDialog />
      </DeliveryScheduleProvider>
    </div>
  );
}
