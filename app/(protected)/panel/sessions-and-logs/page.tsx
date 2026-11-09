"use client";

import SessionAndLogPage from "./components/s&l-page";
import { SessionsAndLogsProvider } from "./provider";
import { MotionPage } from "@/components/page-motion";
import { ManagementPageHeading } from "@/components/management-list";
import { MonitorCheck } from "lucide-react";

export default function Page() {
  return (
    <MotionPage className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <SessionsAndLogsProvider>
        <section className="space-y-5">
          <ManagementPageHeading title="Sessions and logs" description="Review connected sessions and investigate real-time activity." icon={<MonitorCheck className="size-5" />} />
          <SessionAndLogPage />
        </section>
      </SessionsAndLogsProvider>
    </MotionPage>
  );
}
