"use client";

import { Suspense } from "react";
import { FileText, Plus, ShoppingCart, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalProvider, useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { OrdersProvider } from "./provider";
import OrderDialog from "./components/dialog";
import DataTable from "./components/data-table";
import { useOrders } from "./provider";
import OrderPage from "./components/order-page";
import OrderItemDialog from "./components/item-dialog";
import { MotionPage } from "@/components/page-motion";

export default function Page() { return <Suspense fallback={<p role="status">Loading records?</p>}><PageContent /></Suspense>; }

function PageContent() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <ModalProvider>
        <OrdersProvider>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-3xl tracking-tight">Orders</h2>
              <p className="text-muted-foreground text-sm">
                Manage customer orders, products, and delivery methods.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">Order totals below use saved checkout prices. Missing historical prices remain Unverified. Cancelled orders retain their recorded value.</p>
            <OrderDialog />
            <OrderPage />
          </section>
        </OrdersProvider>
      </ModalProvider>
    </MotionPage>
  );
}
