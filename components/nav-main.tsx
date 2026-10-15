"use client";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { usePageStore } from "@/stores/page-store";
import { CirclePlusIcon, MailIcon } from "lucide-react";
import Link from "next/link";
import { useWebSocket } from "./providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import { getSidebars, leftSidebarData } from "@/constant/left-sidebar";
import { createElement } from "react";
import { Badge } from "./ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { useAuth } from "./providers/auth-provider";
import { Skeleton } from "./ui/skeleton";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: React.ReactNode;
  }[];
}) {
  const { userQuery } = useAuth();
  const { setCurrentPage } = usePageStore();
  const { send } = useWebSocket();

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
          <SidebarMenu key={group[0]}>
            <SidebarGroupLabel>{group[0]}</SidebarGroupLabel>
            {group[1].map((item) => (
              <SidebarMenuItem key={item.title}>
                <Link
                  href={item.isDisabled ? "#" : item.url}
                  onClick={() => {
                    send({
                      type: REQUESTS.CHANGE_PAGE,
                      payload: [item.title],
                    });
                    setCurrentPage(item.title);
                  }}
                >
                  <SidebarMenuButton
                    className={`cursor-pointer group-data-[collapsible=icon]:p-1.5! ${item.isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                    tooltip={item.title}
                    isActive={
                      item.title === usePageStore.getState().currentPage
                    }
                    disabled={item.isDisabled}
                  >
                    {createElement(item.icon)}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
