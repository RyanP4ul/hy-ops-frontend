"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import { UserProvider } from "./provider";
import UserPage from "./components/user-page";
import UserDialog from "./components/dialog";

export default function Page() {
  return (
    <div className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <ModalProvider>
        <UserProvider>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-3xl tracking-tight">Users</h2>
              <p className="text-muted-foreground text-sm">
                Manage your users and their access to the application.
              </p>
            </div>
            <UserDialog />
            <UserPage />
          </section>
        </UserProvider>
      </ModalProvider>
    </div>
  );
}
