"use client";

import { Activity, Monitor } from "lucide-react";
import DataTable from "./session-data-table";
import WsLogsDataTable from "./ws-logs-data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionsAndLogs } from "../provider";

export default function SessionAndLogPage() {
  const { tab, setTab, setPage, setSearchQuery } = useSessionsAndLogs();

  return (
    <Tabs value={tab} onValueChange={(value) => {
      if (value !== "sessions" && value !== "logs") return;
      setPage((current) => ({ ...current, pageIndex: 0 }));
      setSearchQuery("");
      setTab(value);
    }} className="gap-4">
      <TabsList className="h-auto w-full justify-start p-1 sm:w-fit" aria-label="Session monitoring views">
        <TabsTrigger value="sessions" className="gap-2 px-3 py-2"><Monitor className="size-4" aria-hidden="true" />Active sessions</TabsTrigger>
        <TabsTrigger value="logs" className="gap-2 px-3 py-2"><Activity className="size-4" aria-hidden="true" />WebSocket activity</TabsTrigger>
      </TabsList>
      <TabsContent value="sessions"><DataTable /></TabsContent>
      <TabsContent value="logs"><WsLogsDataTable /></TabsContent>
    </Tabs>
  );
}
