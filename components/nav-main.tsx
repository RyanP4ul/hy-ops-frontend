"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSidebarRouteActive } from "@/lib/sidebar-route";
import { getSidebars, type SidebarGroupItem } from "@/constant/left-sidebar";
import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { createElement, useId, useState } from "react";
import { useAuth } from "./providers/auth-provider";
import { Skeleton } from "./ui/skeleton";

function NavSidebarItem({
  item,
  pathname,
}: {
  item: SidebarGroupItem;
  pathname: string | null;
}) {
  const submenuId = useId();
  const isActive = isSidebarRouteActive(pathname, item.url, item.isDisabled);
  const subItems = item.items ?? [];
  const hasActiveSubItem = subItems.some((subItem) =>
    isSidebarRouteActive(pathname, subItem.url, subItem.isDisabled),
  );
  const [open, setOpen] = useState(true);
  const [prevActiveSub, setPrevActiveSub] = useState(hasActiveSubItem);

  if (hasActiveSubItem && !prevActiveSub) {
    setPrevActiveSub(true);
    setOpen(true);
  } else if (!hasActiveSubItem && prevActiveSub) {
    setPrevActiveSub(false);
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={item.isDisabled ? undefined : <Link href={item.url} />}
        className={cn(
          "cursor-pointer group-data-[collapsible=icon]:p-1.5!",
          item.isDisabled && "cursor-not-allowed opacity-50",
        )}
        tooltip={item.title}
        isActive={isActive}
        aria-current={isActive ? "page" : undefined}
        disabled={item.isDisabled}
      >
        {createElement(item.icon, { "aria-hidden": true })}
        <span>{item.title}</span>
      </SidebarMenuButton>
      {subItems.length > 0 && (
        <>
          <SidebarMenuAction
            type="button"
            aria-expanded={open}
            aria-controls={submenuId}
            aria-label={
              open
                ? `Collapse ${item.title} submenu`
                : `Expand ${item.title} submenu`
            }
            onClick={() => setOpen((prev) => !prev)}
            className="cursor-pointer"
          >
            <ChevronRightIcon
              aria-hidden="true"
              className={cn("transition-transform", open && "rotate-90")}
            />
          </SidebarMenuAction>
          <SidebarMenuSub
            id={submenuId}
            hidden={!open}
            className={cn(!open && "hidden")}
          >
            {subItems.map((subItem) => {
              const subActive = isSidebarRouteActive(
                pathname,
                subItem.url,
                subItem.isDisabled,
              );
              return (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    render={
                      subItem.isDisabled ? undefined : (
                        <Link href={subItem.url} />
                      )
                    }
                    className={cn(
                      "cursor-pointer data-active:font-medium",
                      subItem.isDisabled && "cursor-not-allowed opacity-50",
                    )}
                    isActive={subActive}
                    aria-current={subActive ? "page" : undefined}
                    aria-disabled={subItem.isDisabled || undefined}
                  >
                    {subItem.icon &&
                      createElement(subItem.icon, { "aria-hidden": true })}
                    <span>{subItem.title}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </>
      )}
    </SidebarMenuItem>
  );
}

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
                <NavSidebarItem
                  key={item.title}
                  item={item}
                  pathname={pathname}
                />
              ))}
            </SidebarMenu>
          </div>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
