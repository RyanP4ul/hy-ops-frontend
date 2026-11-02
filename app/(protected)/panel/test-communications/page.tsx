"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Smartphone,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MotionPage } from "@/components/page-motion";
import { cn } from "@/lib/utils";

type Channel = "SMS" | "Email";
type Tab = Channel | "Templates";

const messages = [
  { recipient: "Maria Santos", detail: "+63 917 482 1092", channel: "SMS", subject: "Delivery update", status: "Delivered", sent: "Today, 10:42 AM" },
  { recipient: "Daniel Reyes", detail: "daniel.reyes@email.com", channel: "Email", subject: "Order #HY-2048 is on its way", status: "Delivered", sent: "Today, 9:18 AM" },
  { recipient: "Angela Cruz", detail: "+63 905 118 7734", channel: "SMS", subject: "Payment received", status: "Failed", sent: "Yesterday, 4:36 PM" },
  { recipient: "Northstar Cafe", detail: "hello@northstar.cafe", channel: "Email", subject: "Your order has been delivered", status: "Queued", sent: "Yesterday, 2:10 PM" },
  { recipient: "Rafael Lim", detail: "+63 926 334 8120", channel: "SMS", subject: "Your order is ready", status: "Delivered", sent: "Oct 18, 11:05 AM" },
];

const templates = [
  { name: "Order dispatched", channel: "SMS" as Channel, description: "Let customers know their order is on the way.", used: "24 uses", updated: "Updated 2 days ago", body: "Hi {{customer_name}}, your order #{{order_number}} is on its way. Track it in your HyOps account.", subject: "" },
  { name: "Payment confirmation", channel: "Email" as Channel, description: "Confirm payment and share the next steps.", used: "18 uses", updated: "Updated 5 days ago", body: "Hi {{customer_name}},\n\nWe received your payment for order #{{order_number}}. Thank you for choosing HyOps.", subject: "Payment received for order #{{order_number}}" },
  { name: "Delivery completed", channel: "SMS" as Channel, description: "Close the loop after a successful delivery.", used: "41 uses", updated: "Updated 1 week ago", body: "Hi {{customer_name}}, your order #{{order_number}} has been delivered. Thank you for choosing HyOps!", subject: "" },
  { name: "Welcome to HyOps", channel: "Email" as Channel, description: "A warm welcome for new customers.", used: "9 uses", updated: "Updated 2 weeks ago", body: "Hi {{customer_name}},\n\nWelcome to HyOps. We are excited to have you with us.", subject: "Welcome to HyOps" },
];

const customers = [
  { id: "maria", name: "Maria Santos", detail: "+63 917 482 1092", email: "maria.santos@email.com", initials: "MS" },
  { id: "daniel", name: "Daniel Reyes", detail: "daniel.reyes@email.com", email: "daniel.reyes@email.com", initials: "DR" },
  { id: "angela", name: "Angela Cruz", detail: "+63 905 118 7734", email: "angela.cruz@email.com", initials: "AC" },
  { id: "rafael", name: "Rafael Lim", detail: "+63 926 334 8120", email: "rafael.lim@email.com", initials: "RL" },
];

const stats = [
  { label: "Messages sent", value: "1,284", change: "+12.5%", icon: Send, tone: "text-blue-600 bg-blue-50" },
  { label: "Delivered", value: "1,241", change: "96.7% delivery rate", icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
  { label: "Failed", value: "18", change: "1.4% of total", icon: XCircle, tone: "text-rose-600 bg-rose-50" },
  { label: "Queued", value: "25", change: "Processing now", icon: Clock3, tone: "text-amber-600 bg-amber-50" },
];

export default function CommunicationsPage() {
  const [tab, setTab] = useState<Tab>("SMS");
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [channel, setChannel] = useState<Channel>("SMS");
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(["maria", "daniel", "angela"]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const filteredMessages = useMemo(
    () =>
      messages.filter((message) =>
        `${message.recipient} ${message.detail} ${message.subject}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [search],
  );

  const openComposer = (nextChannel: Channel = tab === "Email" ? "Email" : "SMS") => {
    setChannel(nextChannel);
    setSent(false);
    setRecipientOpen(false);
    setSelectedTemplate("");
    setSubject("");
    setBody("");
    setComposerOpen(true);
  };

  const channelTemplates = templates.filter((template) => template.channel === channel);
  const selectedCustomer = customers.find((customer) => selectedRecipients.includes(customer.id)) ?? customers[0];
  const applyTemplate = (templateName: string) => {
    const template = channelTemplates.find((item) => item.name === templateName);
    setSelectedTemplate(templateName);
    setBody(template?.body ?? "");
    setSubject(template?.subject ?? "");
  };
  const toggleRecipient = (customerId: string) => {
    setSelectedRecipients((current) =>
      current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId],
    );
  };
  const changeChannel = (nextChannel: Channel) => {
    setChannel(nextChannel);
    setSelectedTemplate("");
    setSubject("");
    setBody("");
  };
  const queueMessage = () => {
    if (selectedRecipients.length === 0 || !body.trim() || (channel === "Email" && !subject.trim())) return;
    setSent(true);
  };

  return (
    <MotionPage className="min-h-full bg-muted/20 px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-foreground">Communications</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Communications</h1>
            <p className="mt-1 text-muted-foreground">
              Send updates and keep your customers in the loop.
            </p>
          </div>
          <Button onClick={() => openComposer()} className="gap-2 self-start">
            <Plus className="size-4" />
            Compose message
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
                </div>
                <div className={cn("rounded-lg p-2.5", stat.tone)}>
                  <stat.icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b">
          {(["SMS", "Email", "Templates"] as Tab[]).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={cn(
                "relative px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                tab === item && "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-foreground",
              )}
            >
              {item === "SMS" && <MessageSquare className="mr-2 inline size-4" />}
              {item === "Email" && <Mail className="mr-2 inline size-4" />}
              {item === "Templates" && <FileText className="mr-2 inline size-4" />}
              {item}
            </button>
          ))}
        </div>

        {tab === "Templates" ? (
          <section className="space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold">Message templates</h2>
                <p className="text-sm text-muted-foreground">Create reusable messages for common updates.</p>
              </div>
              <Button variant="outline" className="gap-2" onClick={() => openComposer("SMS")}>
                <Plus className="size-4" /> New template
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <Card key={template.name} className="border-0 shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-muted p-2.5">
                          {template.channel === "SMS" ? <MessageSquare className="size-4" /> : <Mail className="size-4" />}
                        </div>
                        <div>
                          <h3 className="font-medium">{template.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" aria-label={`More options for ${template.name}`}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{template.channel}</Badge>
                      <span>{template.used}</span><span>·</span><span>{template.updated}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex-row items-center justify-between border-b px-5 py-4">
                <div>
                  <CardTitle>{tab} history</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Recent {tab.toLowerCase()} messages and delivery status.</p>
                </div>
                <Button variant="outline" className="hidden gap-2 sm:flex" onClick={() => openComposer(tab)}>
                  <Plus className="size-4" /> Compose {tab}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages..." className="pl-9" />
                  </div>
                  <Button variant="outline" className="justify-between gap-8 font-normal text-muted-foreground">
                    All statuses <ChevronDown className="size-4" />
                  </Button>
                  <Button variant="outline" className="justify-between gap-8 font-normal text-muted-foreground">
                    Last 30 days <ChevronDown className="size-4" />
                  </Button>
                </div>
                <div className="hidden grid-cols-[1.4fr_1fr_1.5fr_1fr_1fr_auto] gap-4 border-b bg-muted/30 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Recipient</span><span>Channel</span><span>Message</span><span>Status</span><span>Sent</span><span />
                </div>
                <div>
                  {filteredMessages.filter((message) => message.channel === tab).map((message) => (
                    <div key={`${message.recipient}-${message.sent}`} className="grid gap-3 border-b px-5 py-4 last:border-0 md:grid-cols-[1.4fr_1fr_1.5fr_1fr_1fr_auto] md:items-center md:gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-medium">{message.recipient.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
                        <div><p className="text-sm font-medium">{message.recipient}</p><p className="text-xs text-muted-foreground">{message.detail}</p></div>
                      </div>
                      <span className="text-sm text-muted-foreground">{message.channel}</span>
                      <span className="truncate text-sm">{message.subject}</span>
                      <span><Badge variant={message.status === "Delivered" ? "default" : message.status === "Failed" ? "destructive" : "secondary"}>{message.status}</Badge></span>
                      <span className="text-sm text-muted-foreground">{message.sent}</span>
                      <Button variant="ghost" size="icon" aria-label={`Open message for ${message.recipient}`}><ArrowUpRight className="size-4" /></Button>
                    </div>
                  ))}
                  {filteredMessages.filter((message) => message.channel === tab).length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No messages found.</div>}
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>

      {composerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setComposerOpen(false)}>
          <div className="flex h-full w-full max-w-xl flex-col bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-5">
              <div><h2 className="text-lg font-semibold">Compose {channel}</h2><p className="text-sm text-muted-foreground">Create a message using local preview data.</p></div>
              <Button variant="ghost" size="icon" onClick={() => setComposerOpen(false)}><X className="size-4" /></Button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {sent ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800">
                  <CheckCircle2 className="mx-auto size-10" />
                  <h3 className="mt-3 font-semibold">Message queued</h3>
                  <p className="mt-1 text-sm">This is a UI-only preview. No message was sent.</p>
                  <Button variant="outline" className="mt-5" onClick={() => setComposerOpen(false)}>Close</Button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Channel</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["SMS", "Email"] as Channel[]).map((item) => (
                        <button key={item} onClick={() => changeChannel(item)} className={cn("flex items-center gap-2 rounded-lg border p-3 text-left text-sm", channel === item && "border-foreground bg-muted")}>
                          <span className="flex size-8 items-center justify-center rounded-md bg-muted">{item === "SMS" ? <Smartphone className="size-4" /> : <Mail className="size-4" />}</span>{item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <label className="mb-2 block text-sm font-medium">Recipients</label>
                    <button type="button" onClick={() => setRecipientOpen((open) => !open)} className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm">
                      <span className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" /> {selectedRecipients.length} customer{selectedRecipients.length === 1 ? "" : "s"} selected</span>
                      <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", recipientOpen && "rotate-180")} />
                    </button>
                    {recipientOpen && (
                      <div className="absolute inset-x-0 top-full z-10 mt-2 rounded-lg border bg-background p-2 shadow-lg">
                        <div className="mb-1 flex items-center justify-between px-2 py-1 text-xs text-muted-foreground">
                          <span>Select recipients</span>
                          <button type="button" className="font-medium text-foreground hover:underline" onClick={() => setSelectedRecipients(selectedRecipients.length === customers.length ? [] : customers.map((customer) => customer.id))}>
                            {selectedRecipients.length === customers.length ? "Clear all" : "Select all"}
                          </button>
                        </div>
                        {customers.map((customer) => (
                          <button type="button" key={customer.id} onClick={() => toggleRecipient(customer.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted">
                            <span className={cn("flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium", selectedRecipients.includes(customer.id) && "bg-primary text-primary-foreground")}>{selectedRecipients.includes(customer.id) ? "✓" : customer.initials}</span>
                            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{customer.name}</span><span className="block truncate text-xs text-muted-foreground">{channel === "SMS" ? customer.detail : customer.email}</span></span>
                            {selectedRecipients.includes(customer.id) && <CheckCircle2 className="size-4 text-primary" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="message-template" className="mb-2 block text-sm font-medium">Template <span className="font-normal text-muted-foreground">(optional)</span></label>
                    <select id="message-template" value={selectedTemplate} onChange={(event) => applyTemplate(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="">Start from scratch</option>
                      {channelTemplates.map((template) => <option key={template.name} value={template.name}>{template.name}</option>)}
                    </select>
                    <p className="mt-1.5 text-xs text-muted-foreground">{channelTemplates.length} {channel.toLowerCase()} template{channelTemplates.length === 1 ? "" : "s"} available</p>
                  </div>
                  {channel === "Email" && <div><label htmlFor="message-subject" className="mb-2 block text-sm font-medium">Subject</label><Input id="message-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Your order is on its way" /></div>}
                  <div>
                    <label htmlFor="message-body" className="mb-2 block text-sm font-medium">Message</label>
                    <Textarea id="message-body" className="min-h-36 resize-none" value={body} onChange={(event) => setBody(event.target.value)} placeholder={channel === "SMS" ? "Write your SMS message..." : "Write your email message..."} />
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>Use variables like {"{{customer_name}}"}</span><span>{channel === "SMS" ? `${body.length} / 160 characters` : `${body.length} characters`}</span></div>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-4">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{channel === "SMS" ? <Smartphone className="size-3.5" /> : <Mail className="size-3.5" />} Preview · {selectedCustomer.name}</p>
                    <p className="whitespace-pre-line text-sm">{(body || "Your message preview will appear here.").replaceAll("{{customer_name}}", selectedCustomer.name).replaceAll("{{order_number}}", "HY-2048")}</p>
                  </div>
                  {selectedRecipients.length === 0 && <p className="text-sm text-destructive">Select at least one recipient to continue.</p>}
                </>
              )}
            </div>
            {!sent && <div className="flex items-center justify-end gap-3 border-t px-6 py-4"><Button variant="outline" onClick={() => setComposerOpen(false)}>Cancel</Button><Button className="gap-2" disabled={selectedRecipients.length === 0 || !body.trim() || (channel === "Email" && !subject.trim())} onClick={queueMessage}><Send className="size-4" /> Queue message</Button></div>}
          </div>
        </div>
      )}
    </MotionPage>
  );
}
