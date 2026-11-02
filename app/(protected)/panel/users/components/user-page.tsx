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

export default function UserPage() {
  const { openModal } = useModal();
  return (
    <section>
      <Card>
        <CardHeader className="max-sm:flex max-sm:flex-col max-sm:items-start max-sm:gap-2">
          <CardTitle className="leading-none">Users</CardTitle>
          <CardDescription>
            Manage accounts, access, and account status.
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
                    title: "Add User",
                    description: "Create a user account.",
                    action: "Add User",
                  });
                }}
              >
                <Plus className="h-3 w-3" />
                <span>Add User</span>
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
