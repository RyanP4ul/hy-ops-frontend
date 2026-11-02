"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "./data-table";
import { DialogMode } from "@/types/dialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModal } from "@/components/providers/modal-provider";
import { StockTools } from "./stock-tools";
import { StockSummary } from "./stock-summary";

export default function InventoryPage() {
  const { openModal } = useModal();

  return (
    <section>
      <Card>
        <CardHeader className="max-sm:flex max-sm:flex-col max-sm:items-start max-sm:gap-2">
          <CardTitle className="leading-none">Inventory</CardTitle>
          <CardDescription>
            Track stock levels, reserved quantities, and warehouse availability.
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="cursor-pointer"
                onClick={() => {
                  openModal(DialogMode.INSERT, {
                    title: "Add Inventory Item",
                    description: "Create a new inventory record below.",
                    action: "Add Inventory Item",
                  });
                }}
              >
                <Plus className="h-3 w-3" />
                <span>Add Inventory Item</span>
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          <StockSummary />
          <StockTools />
          <DataTable />
        </CardContent>
      </Card>
    </section>
  );
}
