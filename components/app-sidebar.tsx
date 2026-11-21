"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirstMatchingSidebarUrl } from "@/lib/sidebar-route";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getSidebars } from "@/constant/left-sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const { userQuery } = useAuth();
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchId = React.useId();

  const role = userQuery.data?.role || "user";
  const sidebarData = React.useMemo(() => getSidebars(role), [role]);

  React.useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (searchQuery) {
        event.preventDefault();
        setSearchQuery("");
      } else {
        searchInputRef.current?.blur();
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      // Prevent premature navigation while an IME composition candidate is being confirmed.
      if (event.nativeEvent.isComposing || event.keyCode === 229) {
        return;
      }
      const targetUrl = getFirstMatchingSidebarUrl(sidebarData, searchQuery);
      if (targetUrl) {
        router.push(targetUrl);
      }
    }
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="gap-2.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/panel" />}
            >
              <Image
                src="/hy-ops-logo.png"
                alt="HyOps Logo"
                width={32}
                height={32}
                className="mr-2"
              />
              <span className="text-base font-semibold tracking-tight">HyOps</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <search
          aria-label="Sidebar navigation"
          className="px-0.5 group-data-[collapsible=icon]:hidden"
        >
          <label htmlFor={searchId} className="sr-only">
            Search sidebar navigation
          </label>
          <div className="relative flex items-center">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground"
            />
            <SidebarInput
              ref={searchInputRef}
              id={searchId}
              name="sidebar-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search menu..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              className="h-8 rounded-lg border-sidebar-border/80 bg-background/85 pl-8 pr-12 text-xs transition-colors placeholder:text-muted-foreground focus-visible:bg-background [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear sidebar search"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-1 flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <XIcon className="size-3.5" aria-hidden="true" />
              </button>
            ) : (
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-2 hidden select-none items-center gap-0.5 rounded border bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex"
              >
                Ctrl K
              </kbd>
            )}
          </div>
        </search>
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          searchQuery={searchQuery}
          onClearSearch={() => {
            setSearchQuery("");
            searchInputRef.current?.focus();
          }}
        />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
