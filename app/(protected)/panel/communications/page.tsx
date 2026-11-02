"use client";
import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmsPanel } from "./components/sms-panel";
import { EmailPanel } from "./components/email-panel";

export default function CommunicationsPage() {
  const [channel, setChannel] = useState("sms");
  return <div className="min-w-0 space-y-6 px-4 py-6 lg:px-6">
    <header><h1 className="text-3xl font-semibold tracking-tight">Communications</h1><p className="mt-2 text-sm text-muted-foreground">Send text messages and email from your HYOps workspace.</p></header>
    <Tabs value={channel} onValueChange={value => setChannel(String(value))} className="min-w-0 gap-6">
      <TabsList aria-label="Communication channel"><TabsTrigger value="sms" className="min-w-24"><MessageSquare className="size-4" />SMS</TabsTrigger><TabsTrigger value="email" className="min-w-24"><Mail className="size-4" />Email</TabsTrigger></TabsList>
      <TabsContent value="sms" keepMounted className="min-w-0"><SmsPanel active={channel === "sms"} /></TabsContent>
      <TabsContent value="email" keepMounted className="min-w-0"><EmailPanel /></TabsContent>
    </Tabs>
  </div>;
}
