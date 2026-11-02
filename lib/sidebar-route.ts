/** Match path segments, with the dashboard active only at its own root. */
export function isSidebarRouteActive(pathname: string | null, href: string, disabled = false): boolean {
  if (!pathname || disabled || !href.startsWith("/")) return false;
  const normalize = (value: string) => value.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  const path = normalize(pathname), target = normalize(href);
  return path === target || (target !== "/panel" && target !== "/" && path.startsWith(`${target}/`));
}
