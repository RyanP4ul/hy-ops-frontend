"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { ConnectionProvider } from "@/components/providers/connection-provider";
import QueryProvider from "@/components/providers/query-provider";
import { WebSocketProvider } from "@/components/providers/websocket-provider";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import React from "react";
import { SettingProvider } from "@/components/providers/setting-provider";
import { NotificationProvider } from "@/components/providers/notification-provider";
import { AuthProvider } from "@/components/providers/auth-provider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <WebSocketProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SettingProvider>
              <NotificationProvider>
                <TooltipProvider>
                  <SidebarProvider
                    defaultOpen={true}
                    style={
                      {
                        "--sidebar-width": "calc(var(--spacing) * 72)",
                        "--header-height": "calc(var(--spacing) * 12)",
                      } as React.CSSProperties
                    }
                  >
                    <AppSidebar variant="inset" collapsible="icon" />
                    <SidebarInset
                      className={cn(
                        "[html[data-content-layout=centered]_&>*]:mx-auto",
                        "[html[data-content-layout=centered]_&>*]:w-full",
                        "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
                        "peer-data-[variant=inset]:border",
                        "[--dashboard-header-height:--spacing(12)]",
                        "min-w-0 overflow-x-clip",
                      )}
                    >
                      <SiteHeader />
                      <ConnectionProvider>{children}</ConnectionProvider>
                    </SidebarInset>
                  </SidebarProvider>
                  <Toaster position="top-right" />
                </TooltipProvider>
              </NotificationProvider>
            </SettingProvider>
          </ThemeProvider>
        </WebSocketProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
