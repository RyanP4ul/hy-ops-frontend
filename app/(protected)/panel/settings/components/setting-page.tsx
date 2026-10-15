"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TabInventory from "@/app/(protected)/panel/settings/components/tab-inventory";
import React from "react";
import TabGeneral from "./tab-general";
import { useSetting } from "@/components/providers/setting-provider";

export default function SettingPage() {
  const { settingQuery: query, isModified } = useSetting();

  return (
    <div className="flex flex-col gap-4 md:gap-6 py-4 md:py-6 px-4 lg:px-6">
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <TabGeneral />
        </TabsContent>
        <TabsContent value="inventory">
          <TabInventory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
