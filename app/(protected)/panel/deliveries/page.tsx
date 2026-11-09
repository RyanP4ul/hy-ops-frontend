"use client";

import { Suspense } from "react";
import { ModalProvider } from "@/components/providers/modal-provider";
import { DeliveriesProvider } from "./provider";
import DeliveriesPage from "./components/deliveries-page";
import DeliveriesDialog from "./components/dialog";
import { MotionPage } from "@/components/page-motion";
import { ManagementPageHeading } from "@/components/management-list";
import { Truck } from "lucide-react";

export default function Page() { return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Loading deliveries…</p>}><PageContent /></Suspense>; }

function PageContent() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <DeliveriesProvider>
        <ModalProvider>
          <section className="space-y-5">
            <ManagementPageHeading title="Deliveries" description="Follow delivery progress, manage assignments, and review delivery outcomes." icon={<Truck className="size-5" />} />
            <DeliveriesDialog />
            <DeliveriesPage />
          </section>
        </ModalProvider>
      </DeliveriesProvider>
    </MotionPage>
  );
}
