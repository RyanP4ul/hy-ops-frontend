"use client";

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "next-themes";
import { Bell, BellCheck, Check, CheckCheck, ChevronRight, CircleX, CreditCard, Download, Info, Loader2, Moon, PackageOpen, Sun, TriangleAlert, Truck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { notificationPresentation } from "@/lib/notification";
import { usePageStore } from "@/stores/page-store";
import { useConnectionStore } from "@/stores/connection-store";
import { useAuth } from "./providers/auth-provider";
import { useNotification } from "./providers/notification-provider";
import { formatCompactElapsedTime, formatElapsedTime } from "@/utils/time";

const notificationIcons = { inventory: PackageOpen, payment: CreditCard, delivery: Truck, info: Info, success: Check, warning: TriangleAlert, error: CircleX };

function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const { userQuery } = useAuth();
  const { notification_query: query, markAllAsRead, markAsRead, markingAllRead, markingId } = useNotification();
  const rows = query.data?.rows ?? [];
  const unread = query.data?.total_unread ?? 0;
  const activeFilter = unread > 0 ? filter : "all";
  const visibleRows = activeFilter === "unread" ? rows.filter(row => !row.is_read) : rows;
  const bodyHeight = "h-[min(23rem,calc(100dvh-10rem))]";

  function toggleExpanded(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) void query.refetch(); }}>
    <PopoverTrigger render={<Button
      variant="ghost"
      size="icon"
      className="relative size-9 shrink-0"
      aria-label="Notifications"
      aria-description={unread > 0 ? `${unread} unread ${unread === 1 ? "notification" : "notifications"}` : undefined}
    >
      <Bell aria-hidden="true" className="size-4" />
      {unread > 0 && <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground ring-2 ring-background">{unread > 99 ? "99+" : unread}</span>}
    </Button>} />
    <PopoverContent role="dialog" aria-label="Notifications" align="end" sideOffset={10} className="w-[min(22.5rem,calc(100vw-1rem))] gap-0 overflow-hidden rounded-xl border border-border/80 bg-popover p-0 shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b px-3.5 py-3">
        <div className="min-w-0">
          <PopoverTitle className="text-sm font-semibold leading-none tracking-tight">Notifications</PopoverTitle>
          <p className="mt-1 text-[11px] leading-none text-muted-foreground">{unread > 0 ? `${unread} unread ${unread === 1 ? "notification" : "notifications"}` : "Your latest updates"}</p>
        </div>
        {rows.length > 0 && <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground" disabled={unread === 0 || markingAllRead} onClick={() => void markAllAsRead()}>
          {markingAllRead ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <CheckCheck aria-hidden="true" className="size-3.5" />}Mark all as read
        </Button>}
      </div>
      {rows.length > 0 && unread > 0 && (
        <div className="flex items-center gap-1 border-b bg-muted/25 px-3.5 py-1.5">
          <button
            type="button"
            aria-pressed={activeFilter === "all"}
            onClick={() => setFilter("all")}
            className={cn(
              "inline-flex min-h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              activeFilter === "all" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            All
          </button>
          <button
            type="button"
            aria-pressed={activeFilter === "unread"}
            onClick={() => setFilter("unread")}
            className={cn(
              "inline-flex min-h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              activeFilter === "unread" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Unread ({unread})
          </button>
        </div>
      )}
      {query.isPending ? <div role="status" className={cn(bodyHeight, "flex flex-col divide-y overflow-hidden")}>
        <span className="sr-only">Loading notifications...</span>
        {[0, 1, 2, 3].map(item => (
          <div key={item} aria-hidden="true" className="flex items-start gap-2.5 px-3.5 py-3">
            <Skeleton className="mt-0.5 size-4 shrink-0 rounded-sm" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
        : query.isError ? <div role="alert" className={cn(bodyHeight, "flex flex-col items-center justify-center gap-2.5 px-6 text-center")}>
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><CircleX className="size-5" /></span>
          <p className="text-sm font-medium">Unable to load notifications</p>
          <Button type="button" size="sm" variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Retrying..." : "Retry notifications"}</Button>
        </div>
        : !rows.length ? <div data-slot="notifications-empty" className={cn(bodyHeight, "flex flex-col items-center justify-center gap-2 px-6 text-center")}>
          <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl bg-muted"><BellCheck className="size-5 text-muted-foreground" /></span>
          <p className="text-sm font-semibold">You&apos;re all caught up</p>
          <p className="text-xs text-muted-foreground">No new updates yet.</p>
        </div>
        : <ScrollArea className={bodyHeight}>
          <ul aria-label="Notification list" className="divide-y divide-border/60">
            {visibleRows.map(notification => {
              const presentation = notificationPresentation(notification.type, userQuery.data?.role);
              const Icon = notificationIcons[presentation.icon];
              const compactTime = formatCompactElapsedTime(notification.created_at);
              const fullTime = formatElapsedTime(notification.created_at);
              const timestampMs = typeof notification.created_at === "number" && Number.isFinite(notification.created_at)
                ? notification.created_at * 1000
                : NaN;
              const isoDate = Number.isFinite(timestampMs) && Number.isFinite(new Date(timestampMs).getTime())
                ? new Date(timestampMs).toISOString()
                : undefined;
              const message = notification.message.trim();
              const isExpanded = expandedIds.has(notification.id);
              const canExpand = !presentation.href && message.length > 95;
              const content = <>
                <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", !notification.is_read ? "text-foreground" : "text-muted-foreground")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("min-w-0 flex-1 line-clamp-2 break-words text-[13px] leading-snug", !notification.is_read ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                      {notification.title}
                    </p>
                    <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                      {compactTime && (
                        <time dateTime={isoDate} aria-label={fullTime} className="text-[11px] tabular-nums text-muted-foreground">
                          {compactTime}
                        </time>
                      )}
                      {!notification.is_read && <span className="size-1.5 shrink-0 rounded-full bg-primary"><span className="sr-only">Unread</span></span>}
                    </div>
                  </div>
                  {message && (
                    <p className={cn("mt-0.5 break-words text-xs leading-snug text-muted-foreground", !isExpanded && "line-clamp-2")}>
                      {message}
                    </p>
                  )}
                  {canExpand && (
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(notification.id)}
                      className="mt-1 inline-flex min-h-6 items-center text-[11px] font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
                {presentation.href && (
                  <>
                    <ChevronRight aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    {presentation.action && <span className="sr-only"> — {presentation.action}</span>}
                  </>
                )}
              </>;
              const rowClass = cn(
                "flex min-w-0 flex-1 items-start gap-2.5 py-2.5 pl-3.5 text-left",
                notification.is_read ? "pr-3.5" : "pr-1.5 sm:pr-3.5",
              );
              return (
                <li
                  key={notification.id}
                  className={cn(
                    "group relative flex items-stretch transition-colors",
                    !notification.is_read && "bg-primary/[0.035] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r-full before:bg-primary dark:bg-primary/[0.06]",
                  )}
                >
                  {presentation.href ? (
                    <Link
                      href={presentation.href}
                      prefetch={false}
                      className={cn(rowClass, "transition-colors hover:bg-accent/70 focus-visible:bg-accent/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring")}
                      onNavigate={() => { setOpen(false); if (!notification.is_read) void markAsRead(notification.id); }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                  {!notification.is_read && (
                    <div className="flex shrink-0 items-center pr-2 sm:pointer-events-none sm:absolute sm:top-1/2 sm:right-2 sm:-translate-y-1/2 sm:pr-0 sm:group-hover:pointer-events-auto sm:group-focus-within:pointer-events-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground sm:bg-popover/95 sm:opacity-0 sm:shadow-xs sm:ring-1 sm:ring-border/70 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100"
                        aria-label={`Mark ${notification.title} as read`}
                        disabled={markingId === notification.id || markingAllRead}
                        onClick={() => void markAsRead(notification.id)}
                      >
                        {markingId === notification.id ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Check aria-hidden="true" className="size-3.5" />}
                      </Button>
                    </div>
                  )}
                </li>
              );
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
        <a
          href="https://github.com/RyanP4ul/hy-ops-driver-mobile/releases"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Download Mobile APK"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-8 gap-1.5 px-2.5 text-xs",
          )}
        >
          <Download className="size-3.5" />
          <span className="hidden md:inline">Mobile APK</span>
          <span className="md:hidden">APK</span>
        </a>
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
