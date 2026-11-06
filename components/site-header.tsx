"use client";

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "next-themes";
import { ArrowUpRight, Bell, BellCheck, Check, CheckCheck, CircleX, CreditCard, Info, Loader2, Moon, PackageOpen, Sun, TriangleAlert, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { notificationPresentation } from "@/lib/notification";
import { usePageStore } from "@/stores/page-store";
import { useConnectionStore } from "@/stores/connection-store";
import { useAuth } from "./providers/auth-provider";
import { useNotification } from "./providers/notification-provider";
import { formatElapsedTime } from "@/utils/time";

const notificationIcons = { inventory: PackageOpen, payment: CreditCard, delivery: Truck, info: Info, success: Check, warning: TriangleAlert, error: CircleX };
const notificationTones = {
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  info: "bg-muted text-muted-foreground",
};

function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const { userQuery } = useAuth();
  const { notification_query: query, markAllAsRead, markAsRead, markingAllRead } = useNotification();
  const rows = query.data?.rows ?? [];
  const unread = query.data?.total_unread ?? 0;
  const bodyHeight = "h-[min(24rem,calc(100dvh-10rem))]";

  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) void query.refetch(); }}>
    <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative size-9 shrink-0" aria-label="Notifications">
      <Bell className="size-4" />
      {unread > 0 && <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
    </Button>} />
    <PopoverContent role="dialog" aria-label="Notifications" align="end" sideOffset={10} className="w-96 max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-2xl border bg-popover p-0 shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-4">
        <div className="min-w-0"><PopoverTitle className="text-sm font-semibold">Notifications</PopoverTitle><p className="mt-1 text-xs text-muted-foreground">{unread > 0 ? `${unread} unread ${unread === 1 ? "notification" : "notifications"}` : "Your latest updates"}</p></div>
        {rows.length > 0 && <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5 px-2 text-xs" disabled={unread === 0 || markingAllRead} onClick={() => void markAllAsRead()}>
          {markingAllRead ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}Mark all as read
        </Button>}
      </div>
      {query.isPending ? <div role="status" className={cn(bodyHeight, "flex flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground")}><Loader2 className="size-6 animate-spin" /><p className="text-sm">Loading notifications...</p></div>
        : query.isError ? <div role="alert" className={cn(bodyHeight, "flex flex-col items-center justify-center gap-3 p-6 text-center")}>
          <CircleX className="size-7 text-muted-foreground" /><p className="font-medium">Unable to load notifications</p><p className="max-w-60 text-sm text-muted-foreground">Please try again to see your latest updates.</p><Button type="button" size="sm" variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Retrying..." : "Retry notifications"}</Button>
        </div>
        : !rows.length ? <div data-slot="notifications-empty" className={cn(bodyHeight, "flex flex-col items-center justify-center px-6 text-center")}>
          <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted"><BellCheck className="size-6 text-muted-foreground" /></span><p className="text-sm font-semibold">You&apos;re all caught up</p><p className="mt-2 max-w-56 text-sm leading-relaxed text-muted-foreground">New notifications will appear here when something needs your attention.</p>
        </div>
        : <ScrollArea className={bodyHeight}>
          <ul aria-label="Notification list" className="divide-y">
            {rows.map(notification => {
              const presentation = notificationPresentation(notification.type, userQuery.data?.role);
              const Icon = notificationIcons[presentation.icon];
              const content = <>
                <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", notificationTones[presentation.tone])}><Icon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2"><p className={cn("min-w-0 flex-1 break-words text-sm leading-5", !notification.is_read ? "font-semibold" : "font-medium")}>{notification.title}</p>{!notification.is_read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"><span className="sr-only">Unread</span></span>}</div>
                  <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{notification.message}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{formatElapsedTime(notification.created_at)}</span>{presentation.action && <span className="inline-flex items-center gap-1 font-medium">{presentation.action}<ArrowUpRight className="size-3" /></span>}</div>
                </div>
              </>;
              const rowClass = cn("flex w-full gap-3 px-4 py-4 text-left", !notification.is_read && "bg-muted/35");
              return <li key={notification.id}>{presentation.href ? <Link href={presentation.href} prefetch={false}
                className={cn(rowClass, "transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring")}
                onNavigate={() => { setOpen(false); if (!notification.is_read) void markAsRead(notification.id); }}>{content}</Link>
                : <div className={rowClass}>{content}</div>}</li>;
            })}
          </ul>
        </ScrollArea>}
    </PopoverContent>
  </Popover>;
}

export function SiteHeader() {
  const { currentPage } = usePageStore();
  const { resolvedTheme, setTheme } = useTheme();
  const { connected, reconnecting, connecting } = useConnectionStore();
  return <header className={cn(
    "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
    "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
  )}>
    <div className="flex min-w-0 w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
      <SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
      <h1 className="min-w-0 flex-1 truncate text-base font-medium">{currentPage}</h1>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <Badge role="status" aria-label="Live update connection" variant={connected ? "secondary" : "destructive"} className="gap-1.5 text-xs">
          {connected ? <><span className="size-2 rounded-full bg-green-500" /><span className="sm:hidden">Live</span><span className="hidden sm:inline">Live updates connected</span></> : connecting ? "Connecting..." : reconnecting ? "Reconnecting..." : "Disconnected"}
        </Badge>
        <NotificationMenu />
        <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
          <Sun className="size-[1.2rem] rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0" /><Moon className="absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </div>
  </header>;
}
