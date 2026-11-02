"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { request } from "@/components/http";
import { ViewOrderDetails } from "@/components/order-details";
import { QueryFeedback } from "@/components/query-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
      const result = await response.json() as OrderDetail;
      signal.throwIfAborted();
      return result;
    },
  });

  return <Dialog open={open} onOpenChange={setOpen}>
    <Tooltip>
      <TooltipTrigger render={<DialogTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={`View order details ${orderNumber}`} />} />}>
        <Eye className="size-4" />
      </TooltipTrigger>
      <TooltipContent>View order details</TooltipContent>
    </Tooltip>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Order {orderNumber}</DialogTitle>
        <DialogDescription>Order details, saved shipping destination and items.</DialogDescription>
      </DialogHeader>
      <QueryFeedback query={order} label="order details" />
      {(!order.isError || order.data) && <ViewOrderDetails order={order.data ?? null} isLoading={order.isPending} />}
      <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
