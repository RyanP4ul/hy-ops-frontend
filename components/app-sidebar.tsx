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

const data = {
  user: {
    name: "ryanpaul",
    email: "espinola@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/panel",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Products",
      url: "/panel/products",
      icon: <PackageIcon />,
    },
    {
      title: "Inventory",
      url: "/panel/inventory",
      icon: <BoxesIcon />,
    },
    {
      title: "Orders",
      url: "/orders",
      icon: <ShoppingCartIcon />,
    },
    {
      title: "Deliveries",
      url: "/deliveries",
      icon: <TruckIcon />,
    },
    {
      title: "Schedule",
      url: "/schedule",
      icon: <CalendarDaysIcon />,
    },
    {
      title: "Map",
      url: "/map",
      icon: <MapIcon />,
    },
    {
      title: "Payments",
      url: "/panel/payments",
      icon: <CreditCardIcon />,
    },
    {
      title: "Users",
      url: "/panel/users",
      icon: <UsersIcon />,
    },
    {
      title: "Customers",
      url: "/customers",
      icon: <UserRoundIcon />,
    },
    {
      title: "Drivers",
      url: "/drivers",
      icon: <BadgeIcon />,
    },
    {
      title: "Vehicles",
      url: "/vehicles",
      icon: <CarIcon />,
    },
    {
      title: "Warehouses",
      url: "/panel/warehouses",
      icon: <WarehouseIcon />,
    },
    {
      title: "Audit Logs",
      url: "/panel/audit-logs",
      icon: <ClipboardListIcon />,
    },
    {
      title: "Archives",
      url: "/archives",
      icon: <ArchiveIcon />,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: <SettingsIcon />,
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: <CameraIcon />,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: <FileTextIcon />,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: <FileTextIcon />,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: <DatabaseIcon />,
    },
    {
      name: "Reports",
      url: "#",
      icon: <FileChartColumnIcon />,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: <FileIcon />,
    },
  ],
};

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
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
