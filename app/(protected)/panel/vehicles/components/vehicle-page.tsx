"use client";

import { Button } from "@/components/ui/button";
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
import { useModal } from "@/components/providers/modal-provider";
import DataTable from "./data-table";

export default function VehiclePage() {
  const { openModal } = useModal();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">Vehicles</CardTitle>
        <CardDescription>Manage your delivery vehicles.</CardDescription>
        <CardAction>
          <Button
            onClick={() =>
              openModal(DialogMode.INSERT, {
                title: "Add Vehicle",
                description: "Add a new vehicle.",
                action: "Add Vehicle",
              })
            }
          >
            <Plus className="size-4" />
            Add Vehicle
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <DataTable />
      </CardContent>
    </Card>
  );
}
