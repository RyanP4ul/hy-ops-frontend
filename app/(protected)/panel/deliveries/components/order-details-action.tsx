"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { request } from "@/components/http";
import { OrderDetailsDrawer } from "@/components/order-details";
import { QueryFeedback } from "@/components/query-feedback";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { OrderDetail } from "@/schema/order";

export function OrderDetailsAction({ orderId, orderNumber }: { orderId: number; orderNumber: string }) {
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

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`View order details ${orderNumber}`}
              onClick={() => setOpen(true)}
            />
          }
        >
          <Eye className="size-4" />
        </TooltipTrigger>
        <TooltipContent>View order details</TooltipContent>
      </Tooltip>
      <OrderDetailsDrawer
        open={open}
        onOpenChange={setOpen}
        title={orderNumber}
        order={order.data ?? null}
        isLoading={order.isPending}
        feedback={<QueryFeedback query={order} label="order details" />}
      />
    </>
  );
}
