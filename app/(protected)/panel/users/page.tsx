"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import { UserProvider } from "./provider";
import UserPage from "./components/user-page";
import UserDialog from "./components/dialog";
import { MotionPage } from "@/components/page-motion";
import { ManagementPageHeading } from "@/components/management-list";
import { UsersRound } from "lucide-react";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <ModalProvider>
        <UserProvider>
          <section className="space-y-5">
            <ManagementPageHeading title="Users" description="Manage accounts, roles, and access to your workspace." icon={<UsersRound className="size-5" />} />
            <UserDialog />
            <UserPage />
          </section>
        </UserProvider>
      </ModalProvider>
    </MotionPage>
  );
}
