import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { DialogMode } from "@/types/dialog";
import { Plus } from "lucide-react";
import DataTable from "./data-table";

export default function ArchivePage() {
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none">Warehouses</CardTitle>
          <CardDescription>
            Manage your inventory and their variants. Click on an item to view
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DataTable />
        </CardContent>
      </Card>
    </section>
  );
}
