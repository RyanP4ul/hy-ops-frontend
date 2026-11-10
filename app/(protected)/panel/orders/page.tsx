"use client";

import { ShoppingCart } from "lucide-react";
import { ModalProvider, useModal } from "@/components/providers/modal-provider";
import { OrdersProvider, useOrders } from "./provider";
import OrderDialog from "./components/dialog";
import OrderPage from "./components/order-page";
import { MotionPage } from "@/components/page-motion";
import { ManagementPageHeading } from "@/components/management-list";
import { Suspense, useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useSearchParams } from "next/navigation";
import { WalkInSaleDialog } from "./components/walk-in/walk-in-sale-dialog";

export default function Page() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-muted-foreground">
          Loading orders…
        </p>
      }
    >
      <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
        <ModalProvider is_custom={true}>
          <OrdersProvider>
            <PageContent />
          </OrdersProvider>
        </ModalProvider>
      </MotionPage>
    </Suspense>
  );
}

function PageContent() {
  const searchParams = useSearchParams();
  const { walkInOpen, setWalkInOpen } = useOrders();
  const { state, closeModal } = useModal();

  useEffect(() => {
    if (searchParams.get("walkin") === "true") {
      setWalkInOpen(true);
    }
  }, [searchParams]);

  return (
    <>
      <Dialog
        open={state.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeModal();
          }
        }}
      >
        <section className="space-y-5">
          <ManagementPageHeading
            title="Orders"
            description="Review customer orders, track progress, and manage fulfillment."
            icon={<ShoppingCart className="size-5" />}
          />
          <OrderDialog />
          <OrderPage />
        </section>
      </Dialog>
      <WalkInSaleDialog open={walkInOpen} onOpenChange={setWalkInOpen} />
    </>
  );
}
