"use client";

import * as React from "react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  PackageIcon,
  CameraIcon,
  FileTextIcon,
  DatabaseIcon,
  FileChartColumnIcon,
  FileIcon,
  ArchiveIcon,
  BadgeIcon,
  BoxesIcon,
  CalendarDaysIcon,
  CarIcon,
  ClipboardListIcon,
  CreditCardIcon,
  MapIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TruckIcon,
  UserRoundIcon,
  UsersIcon,
  WarehouseIcon,
} from "lucide-react";
import Image from "next/image";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="#" />}
            >
              <Image
                src="/logo.png"
                alt="HyOps Logo"
                width={32}
                height={32}
                className="mr-2"
              />
              <span className="text-base font-semibold">HyOps</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
