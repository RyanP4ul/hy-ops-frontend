"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import {
  Bell,
  BellIcon,
  Check,
  CircleX,
  Info,
  InfoIcon,
  MailIcon,
  MessageSquareIcon,
  Moon,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageStore } from "@/stores/page-store";
import { useConnectionStore } from "@/stores/connection-store";
import { Badge } from "./ui/badge";
import { motion } from "motion/react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { useNotification } from "./providers/notification-provider";
import { formatElapsedTime } from "@/utils/time";

export function SiteHeader() {
  const { currentPage } = usePageStore();
  const { resolvedTheme, setTheme } = useTheme();
  const toggleTheme = () =>
    setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const { connected, reconnecting, connecting } = useConnectionStore();
  const { notification_query, markAllAsRead } = useNotification();

  const notificationType = (type: string) => {
    switch (type) {
      case "warning":
        return <TriangleAlert className="h-4 w-4" />;
      case "error":
        return <CircleX className="h-4 w-4" />;
      case "success":
        return <Check className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
        "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
      )}
    >
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{currentPage}</h1>
        <div className="ml-auto flex items-center gap-2">
          {!connected ? (
            <Badge variant="destructive" className="text-xs">
              {connecting
                ? "Connecting..."
                : reconnecting
                  ? "Reconnecting..."
                  : "Disconnected"}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              System Online
            </Badge>
          )}

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 shrink-0"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {(notification_query.data?.total_unread || 0) > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
                    >
                      {notification_query.data?.total_unread}
                    </motion.span>
                  )}
                </Button>
              }
            />
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-0 shadow-lg"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Notifications</h3>
                {(notification_query.data?.rows?.length || 0) > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                    onClick={async () => await markAllAsRead()}
                  >
                    Mark All Read
                  </Button>
                )}
              </div>

              <ScrollArea className="h-80">
                <div className="px-2 py-2">
                  {(notification_query.data?.rows?.length || 0) < 1 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Empty notifications. You&apos;re all caught up!
                    </p>
                  ) : (
                    <>
                      {notification_query.data?.rows?.map((notification) => (
                        <motion.button
                          key={notification.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2 }}
                          // onClick={() => markAsRead(notification.id)}
                          className={cn(
                            "flex w-full gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent",
                            !notification.is_read && "bg-primary/5",
                          )}
                        >
                          <span className="mt-0.5 text-sm">
                            {notificationType("info")}
                          </span>
                          <div className="flex-1 space-y-1 min-w-0">
                            <p className="text-sm font-medium leading-none">
                              {notification.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70">
                              {formatElapsedTime(notification.created_at)}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </motion.button>
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </div>
    </header>
  );
}
