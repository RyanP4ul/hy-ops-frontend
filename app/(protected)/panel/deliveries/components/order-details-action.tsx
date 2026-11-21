"use client";

import type { TableAction } from "@/components/table-actions";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { request } from "@/components/http";
import { OrderDetailsDrawer } from "@/components/order-details";
import { QueryFeedback } from "@/components/query-feedback";
import type { OrderDetail } from "@/schema/order";

export function useDeliveryOrderDetails({ orderId, orderNumber }: { orderId: number; orderNumber: string }) {
  const [open, setOpen] = useState(false);
  const order = useQuery({
    queryKey: ["order_view", orderId],
    enabled: open,
    queryFn: async ({ signal }) => {
      const response = await request("GET", `/api/orders/${orderId}`);
      if (!response.ok) throw new Error("Unable to load this order.");
      const result = (await response.json()) as OrderDetail;
      signal.throwIfAborted();
      return result;
    },
  });

  const action: TableAction = {
    label: "View order details",
    ariaLabel: `View order details ${orderNumber}`,
    icon: Eye,
    onClick: () => setOpen(true),
  };
  const dialog = (
    <OrderDetailsDrawer
      open={open}
      onOpenChange={setOpen}
      title={orderNumber}
      order={order.data ?? null}
      isLoading={order.isPending}
      feedback={<QueryFeedback query={order} label="order details" />}
    />
  );
  return { action, dialog };
}
