"use client";

import { Suspense } from "react";
import { ShoppingCart } from "lucide-react";
import { ModalProvider } from "@/components/providers/modal-provider";
import { OrdersProvider } from "./provider";
import OrderDialog from "./components/dialog";
import OrderPage from "./components/order-page";
import { MotionPage } from "@/components/page-motion";
import { ManagementPageHeading } from "@/components/management-list";

export default function Page() { return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Loading orders…</p>}><PageContent /></Suspense>; }

function PageContent() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <ModalProvider>
        <OrdersProvider>
          <section className="space-y-5">
            <ManagementPageHeading title="Orders" description="Review customer orders, track progress, and manage fulfillment." icon={<ShoppingCart className="size-5" />} />
            <OrderDialog />
            <OrderPage />
          </section>
        </OrdersProvider>
      </ModalProvider>
    </MotionPage>
  );
}
