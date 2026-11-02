"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import PaymentDialog from "./components/dialog";
import PaymentPage from "./components/payment-page";
import { PaymentsProvider } from "./provider";
import { MotionPage } from "@/components/page-motion";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <ModalProvider>
        <PaymentsProvider>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-3xl tracking-tight">Payments</h2>
              <p className="text-sm text-muted-foreground">
                Record and monitor customer payments against orders.
              </p>
            </div>
            <PaymentDialog />
            <PaymentPage />
          </section>
        </PaymentsProvider>
      </ModalProvider>
    </MotionPage>
  );
}
