"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DialogMode } from "@/types/dialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModal } from "@/components/providers/modal-provider";
import DataTable from "./data-table";

export default function DeliverySchedulePage() {
  const { openModal } = useModal();

  return (
    <section>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <DataTable />
        </CardContent>
      </Card>
    </section>
  );
}
