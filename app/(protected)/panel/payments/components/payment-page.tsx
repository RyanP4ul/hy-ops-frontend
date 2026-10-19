"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import DataTable from "./data-table";

export default function PaymentPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">Payment records</CardTitle>
        <CardDescription>
          View and record payments received for customer orders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable />
      </CardContent>
    </Card>
  );
}
