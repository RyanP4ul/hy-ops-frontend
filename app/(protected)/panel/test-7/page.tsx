"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CreateOrderWizard } from "./create-order-wizard";

export default function OrdersPage() {
  const [open, setOpen] = useState(false);

  async function handleCreateOrder(data: {
    customer: string;
    product: string;
    quantity: string;
    deliveryMethod: string;
    driver: string;
    vehicle: string;
    scheduledDate: string;
    paymentMethod: string;
  }) {
    // Replace with your actual API request.
    console.log("Order payload:", data);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 size-4" />
        Create Order
      </Button>

      <CreateOrderWizard
        open={open}
        onOpenChange={setOpen}
        onSubmitOrder={handleCreateOrder}
      />
    </>
  );
}
