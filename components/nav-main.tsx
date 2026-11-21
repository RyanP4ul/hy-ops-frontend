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
import {
  filterSidebarGroups,
  isSidebarRouteActive,
} from "@/lib/sidebar-route";
import { getSidebars, type SidebarGroupItem } from "@/constant/left-sidebar";
import { cn } from "@/lib/utils";
import { ChevronRightIcon, SearchXIcon } from "lucide-react";
import { createElement, useId, useMemo, useState } from "react";
import { useAuth } from "./providers/auth-provider";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

function NavSidebarItem({
  item,
  pathname,
  forceOpen,
}: {
  item: SidebarGroupItem;
  pathname: string | null;
  forceOpen?: boolean;
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

  const isExpanded = forceOpen ? true : open;

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
            aria-expanded={isExpanded}
            aria-controls={submenuId}
            aria-label={
              isExpanded
                ? `Collapse ${item.title} submenu`
                : `Expand ${item.title} submenu`
            }
            onClick={() => setOpen((prev) => !prev)}
            className="cursor-pointer"
          >
            <ChevronRightIcon
              aria-hidden="true"
              className={cn("transition-transform", isExpanded && "rotate-90")}
            />
          </SidebarMenuAction>
          <SidebarMenuSub
            id={submenuId}
            hidden={!isExpanded}
            className={cn(!isExpanded && "hidden")}
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

export function NavMain({
  searchQuery = "",
  onClearSearch,
}: {
  searchQuery?: string;
  onClearSearch?: () => void;
}) {
  const { userQuery } = useAuth();
  const pathname = usePathname();
  const trimmedQuery = searchQuery.trim();

  const role = userQuery.data?.role || "user";
  const sidebar = useMemo(() => getSidebars(role), [role]);
  const filteredSidebar = useMemo(
    () => filterSidebarGroups(sidebar, trimmedQuery),
    [sidebar, trimmedQuery],
  );

  if (!userQuery.data) {
    return (
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-2">
          <SidebarMenu>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-[30%] rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
            </div>
          </SidebarMenu>
          <SidebarMenu>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-[30%] rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
            </div>
          </SidebarMenu>
          <SidebarMenu>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-[30%] rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
            </div>
          </SidebarMenu>
          <SidebarMenu>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-[30%] rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-7 w-full rounded-md motion-reduce:animate-none" />
            </div>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const entries = Object.entries(filteredSidebar);
  const totalMatches = entries.reduce(
    (sum, [, items]) =>
      sum + items.reduce((inner, item) => inner + 1 + (item.items?.length ?? 0), 0),
    0,
  );

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        {trimmedQuery && (
          <span className="sr-only" role="status" aria-live="polite">
            {totalMatches === 0
              ? `No navigation items match ${trimmedQuery}`
              : `${totalMatches} navigation ${totalMatches === 1 ? "item" : "items"} found`}
          </span>
        )}

        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-sidebar-border px-3 py-6 text-center">
            <SearchXIcon
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs font-medium text-sidebar-foreground">
              No matching pages
            </p>
            <p className="break-words text-[11px] text-muted-foreground">
              Nothing found for &ldquo;{trimmedQuery}&rdquo;.
            </p>
            {onClearSearch && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="mt-1 cursor-pointer"
                onClick={onClearSearch}
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          entries.map(([groupName, items]) => (
            <div key={groupName}>
              <SidebarGroupLabel>{groupName}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => (
                  <NavSidebarItem
                    key={item.title}
                    item={item}
                    pathname={pathname}
                    forceOpen={Boolean(trimmedQuery)}
                  />
                ))}
              </SidebarMenu>
            </div>
          ))
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
