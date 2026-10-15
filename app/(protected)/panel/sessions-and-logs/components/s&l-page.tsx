import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import DataTable from "./session-data-table";
import WsLogsDataTable from "./ws-logs-data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionsAndLogs } from "../provider";

export default function SessionAndLogPage() {
  const { tab, setTab } = useSessionsAndLogs();

  return (
    <section>
      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="logs">WS Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions">
          <Card className="mt-3">
            <CardHeader>
              <CardTitle className="leading-none">Active Sessions</CardTitle>
              <CardDescription>
                Manage your active sessions and view session details.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-0">
              <DataTable />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logs">
          <Card className="mt-3">
            <CardHeader>
              <CardTitle className="leading-none">WebSocket Logs</CardTitle>
              <CardDescription>
                Review WebSocket activity and message payloads.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-0">
              <WsLogsDataTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
