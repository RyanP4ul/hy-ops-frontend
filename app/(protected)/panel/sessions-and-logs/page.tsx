"use client";

import SessionAndLogPage from "./components/s&l-page";
import { SessionsAndLogsProvider } from "./provider";

export default function Page() {
  return (
    <div className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <SessionsAndLogsProvider>
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-3xl tracking-tight">Sessions and Logs</h2>
            <p className="text-muted-foreground text-sm">
              Monitor user sessions and real-time WebSocket activity.
            </p>
          </div>
          <SessionAndLogPage />
        </section>
      </SessionsAndLogsProvider>
    </div>
  );
}
