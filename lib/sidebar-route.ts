import type { SidebarGroupItem } from "@/constant/left-sidebar";

/** Match path segments, with the dashboard active only at its own root. */
export function isSidebarRouteActive(pathname: string | null, href: string, disabled = false): boolean {
  if (!pathname || disabled || !href.startsWith("/")) return false;
  const normalize = (value: string) => value.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  const path = normalize(pathname), target = normalize(href);
  return path === target || (target !== "/panel" && target !== "/" && path.startsWith(`${target}/`));
}

/** Filter sidebar groups, items, and submenu items by title, group name, or route path. */
export function filterSidebarGroups(
  sidebar: Record<string, SidebarGroupItem[]>,
  query: string,
): Record<string, SidebarGroupItem[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return sidebar;

  const filtered: Record<string, SidebarGroupItem[]> = {};
  for (const [groupName, items] of Object.entries(sidebar)) {
    const groupMatches = groupName.toLowerCase().includes(normalized);
    const matchingItems: SidebarGroupItem[] = [];

    for (const item of items) {
      const itemMatches =
        groupMatches ||
        item.title.toLowerCase().includes(normalized) ||
        item.url.toLowerCase().includes(normalized);

      const matchingSubItems = (item.items ?? []).filter(
        (subItem) =>
          itemMatches ||
          subItem.title.toLowerCase().includes(normalized) ||
          subItem.url.toLowerCase().includes(normalized),
      );

      if (itemMatches) {
        matchingItems.push(item);
      } else if (matchingSubItems.length > 0) {
        matchingItems.push({ ...item, items: matchingSubItems });
      }
    }

    if (matchingItems.length > 0) {
      filtered[groupName] = matchingItems;
    }
  }

  return filtered;
}

/** Return the first enabled route matching a sidebar search query (preferring direct submenu hits). */
export function getFirstMatchingSidebarUrl(
  sidebar: Record<string, SidebarGroupItem[]>,
  query: string,
): string | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  const filtered = filterSidebarGroups(sidebar, normalized);
  for (const [groupName, items] of Object.entries(filtered)) {
    const groupMatches = groupName.toLowerCase().includes(normalized);
    for (const item of items) {
      const itemMatches =
        groupMatches ||
        item.title.toLowerCase().includes(normalized) ||
        item.url.toLowerCase().includes(normalized);

      if (itemMatches && !item.isDisabled) {
        return item.url;
      }

      const firstEnabledSub = (item.items ?? []).find((sub) => !sub.isDisabled);
      if (firstEnabledSub) {
        return firstEnabledSub.url;
      }
    }
  }
  return null;
}
