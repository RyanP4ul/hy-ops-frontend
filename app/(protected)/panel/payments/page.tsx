"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import PaymentDialog from "./components/dialog";
import PaymentPage from "./components/payment-page";
import { PaymentsProvider } from "./provider";
import { CreditCard } from "lucide-react";
import { MotionPage } from "@/components/page-motion";
import { ManagementPageHeading } from "@/components/management-list";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <ModalProvider>
        <PaymentsProvider>
          <section className="space-y-5">
            <ManagementPageHeading title="Payments" description="Review receipts, record customer payments, and manage refunds." icon={<CreditCard className="size-5" />} />
            <PaymentDialog />
            <PaymentPage />
          </section>
        </PaymentsProvider>
      </ModalProvider>
    </MotionPage>
  );
}
