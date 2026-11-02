"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import DataTable from "./data-table";

export default function DeliveriesPage() {
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none">Deliveries</CardTitle>
          <CardDescription>
            Review scheduled routes, driver assignments, and delivery status.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DataTable />
        </CardContent>
      </Card>
    </section>
  );
}
