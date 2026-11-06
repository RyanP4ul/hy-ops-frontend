"use client";

import { Boxes, DatabaseBackup, Loader2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useSetting } from "@/components/providers/setting-provider";
import { MotionPage } from "@/components/page-motion";
import TabGeneral from "./tab-general";
import TabInventory from "./tab-inventory";
import TabBackup from "./tab-backup";

export default function SettingPage() {
  const { settingQuery: query } = useSetting();

  return (
    <MotionPage id="workspace-settings" className="mx-auto flex w-full flex-col gap-8 px-4 py-6 lg:px-8 lg:py-10">
      {query.isPending ? (
        <div role="status" className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading settings…
        </div>
      ) : query.isError && !query.data ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-12 text-center">
          <h2 className="font-medium">Settings couldn’t be loaded</h2>
          <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw aria-hidden="true" /> Try again</Button>
        </div>
      ) : (
        <Tabs defaultValue="general" className="gap-6">
          <TabsList aria-label="Settings categories" className="grid w-full grid-cols-3 justify-start gap-1 rounded-xl border bg-muted/40 p-1 group-data-horizontal/tabs:h-auto sm:flex sm:w-fit">
            <TabsTrigger value="general" className="min-h-11 gap-2 px-2 sm:px-5"><SlidersHorizontal className="hidden sm:block" aria-hidden="true" /> General</TabsTrigger>
            <TabsTrigger value="inventory" className="min-h-11 gap-2 px-2 sm:px-5"><Boxes className="hidden sm:block" aria-hidden="true" /> Inventory</TabsTrigger>
            <TabsTrigger value="backup" className="min-h-11 gap-2 whitespace-normal px-3 sm:px-5"><DatabaseBackup className="hidden sm:block" aria-hidden="true" /> Database backup</TabsTrigger>
          </TabsList>
          <TabsContent value="general" keepMounted className="data-[hidden]:hidden"><TabGeneral /></TabsContent>
          <TabsContent value="inventory" keepMounted className="data-[hidden]:hidden"><TabInventory /></TabsContent>
          <TabsContent value="backup" keepMounted className="data-[hidden]:hidden"><TabBackup /></TabsContent>
        </Tabs>
      )}
    </MotionPage>
  );
}
