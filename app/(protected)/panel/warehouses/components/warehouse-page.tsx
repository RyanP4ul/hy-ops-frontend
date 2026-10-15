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

export default function WarehousePage() {
  const { openModal } = useModal();

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none">Warehouses</CardTitle>
          <CardDescription>
            Manage your inventory and their variants. Click on an item to view
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="lg"
                className="cursor-pointer"
                onClick={() => {
                  openModal(DialogMode.INSERT, {
                    title: "Add Inventory",
                    description: "Add a new inventory item below.",
                    action: "Add Item",
                  });
                }}
              >
                <Plus className="h-3 w-3" />
                <span>Add Inventory</span>
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DataTable />
        </CardContent>
      </Card>
    </section>
  );
}
