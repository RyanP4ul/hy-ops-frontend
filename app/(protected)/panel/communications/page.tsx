"use client";

import { useState } from "react";
import { Mail, MessageSquare, MessagesSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmsPanel } from "./components/sms-panel";
import { EmailPanel } from "./components/email-panel";

export default function CommunicationsPage() {
  const [channel, setChannel] = useState("sms");

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/50 text-foreground sm:flex">
            <MessagesSquare className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Communications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Send templated SMS updates and operational emails from your HYOps workspace.
            </p>
          </div>
        </div>
      </header>

      <Tabs
        value={channel}
        onValueChange={(value) => setChannel(String(value))}
        className="min-w-0 gap-6"
      >
        <TabsList
          aria-label="Communication channel"
          className="grid w-full grid-cols-2 gap-1 rounded-xl border bg-muted/40 p-1 group-data-horizontal/tabs:h-auto sm:inline-flex sm:w-fit"
        >
          <TabsTrigger
            value="sms"
            className="min-h-10 cursor-pointer gap-2 rounded-lg px-4 sm:min-w-32"
          >
            <MessageSquare className="size-4" aria-hidden="true" />
            SMS
          </TabsTrigger>
          <TabsTrigger
            value="email"
            className="min-h-10 cursor-pointer gap-2 rounded-lg px-4 sm:min-w-32"
          >
            <Mail className="size-4" aria-hidden="true" />
            Email
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="sms"
          keepMounted
          className="min-w-0 data-[hidden]:hidden"
        >
          <SmsPanel active={channel === "sms"} />
        </TabsContent>
        <TabsContent
          value="email"
          keepMounted
          className="min-w-0 data-[hidden]:hidden"
        >
          <EmailPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
