"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSidebarRouteActive } from "@/lib/sidebar-route";
import { getSidebars } from "@/constant/left-sidebar";
import { createElement } from "react";
import { useAuth } from "./providers/auth-provider";
import { Skeleton } from "./ui/skeleton";

export function NavMain() {
  const { userQuery } = useAuth();
  const pathname = usePathname();

  if (!userQuery.data) {
    return (
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-2">
          <SidebarMenu>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-[30%] rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
            </div>
          </SidebarMenu>
          <SidebarMenu>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-[30%] rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
            </div>
          </SidebarMenu>
          <SidebarMenu>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-[30%] rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
            </div>
          </SidebarMenu>
          <SidebarMenu>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-[30%] rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
            </div>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const sidebar = getSidebars(userQuery.data?.role || "user");

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        {Object.entries(sidebar).map((group) => (
          <div key={group[0]}>
            <SidebarGroupLabel>{group[0]}</SidebarGroupLabel>
            <SidebarMenu>
            {group[1].map((item) => (
              <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={item.isDisabled ? undefined : <Link href={item.url} />}
                    className={`cursor-pointer group-data-[collapsible=icon]:p-1.5! ${item.isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                    tooltip={item.title}
                    isActive={
                      isSidebarRouteActive(pathname, item.url, item.isDisabled)
                    }
                    aria-current={isSidebarRouteActive(pathname, item.url, item.isDisabled) ? "page" : undefined}
                    disabled={item.isDisabled}
                  >
                    {createElement(item.icon)}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            </SidebarMenu>
          </div>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
