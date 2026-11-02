"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import DataTable from "./data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { usePayments } from "../provider";

export default function PaymentPage() {
  const { openModal } = useModal();
  const { setSelected, form } = usePayments();
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2"><CardTitle className="leading-none">Payment records</CardTitle>
        <CardDescription>
          View and record payments received for customer orders.
        </CardDescription></div>
        <Button type="button" onClick={() => {
          setSelected({ order_id: -1, payment_number: "", version: -1 });
          form.reset({ order_id: -1, payment_number: "", payment_amount: 0, version: -1 });
          openModal(DialogMode.INSERT, { title: "Add payment", description: "Choose an order and record the money received from the customer.", action: "Record payment" });
        }}><Plus aria-hidden="true" className="size-4" />Add payment</Button>
      </CardHeader>
      <CardContent>
        <DataTable />
      </CardContent>
    </Card>
  );
}
