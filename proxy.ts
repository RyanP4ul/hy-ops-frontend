import { isPrototypeRoute } from "@/lib/prototype-routes";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5173";

const protectedRoutes = ["/panel"];
const publicAuthRoutes = ["/", "/login"];

const allowedRoles = ["admin", "staff"];

type AuthUser = {
  role?: string;
  user?: {
    role?: string;
  };
  data?: {
    role?: string;
    user?: {
      role?: string;
    };
  };
};

function matchesRoute(pathname: string, route: string) {
  return route === "/"
    ? pathname === route
    : pathname === route || pathname.startsWith(`${route}/`);
}

async function getAuthenticatedUser(cookie: string): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { cookie },
      cache: "no-store",
    });

    if (!response.ok) return null;

    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
}

function getRole(user: AuthUser | null): string | undefined {
  return (
    user?.role ??
    user?.user?.role ??
    user?.data?.role ??
    user?.data?.user?.role
  )?.toLowerCase();
}

function redirectTo(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (process.env.NODE_ENV === "production" && isPrototypeRoute(pathname)) return new NextResponse("Not found", { status: 404 });

  const isProtected = protectedRoutes.some((route) =>
    matchesRoute(pathname, route),
  );

  const isPublicAuth = publicAuthRoutes.some((route) =>
    matchesRoute(pathname, route),
  );

  if (!isProtected && !isPublicAuth) {
    return NextResponse.next();
  }

  const cookie = request.headers.get("cookie") ?? "";

  // 1. Check the current access token.
  let user = await getAuthenticatedUser(cookie);

  // 2. If authentication fails, try refreshing the tokens.
  let refreshResponse: Response | null = null;

  if (!user) {
    try {
      const refresh = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { cookie },
        cache: "no-store",
      });

      if (refresh.ok) {
        refreshResponse = refresh;

        // Merge refreshed cookies with existing cookies.
        const refreshedCookies =
          typeof refresh.headers.getSetCookie === "function"
            ? refresh.headers.getSetCookie()
            : [refresh.headers.get("set-cookie")].filter(
                (value): value is string => Boolean(value),
              );

        const cookieMap = new Map<string, string>();

        for (const part of cookie.split(";")) {
          const separator = part.indexOf("=");

          if (separator > 0) {
            cookieMap.set(
              part.slice(0, separator).trim(),
              part.slice(separator + 1).trim(),
            );
          }
        }

        for (const setCookie of refreshedCookies) {
          const pair = setCookie.split(";")[0];
          const separator = pair.indexOf("=");

          if (separator > 0) {
            cookieMap.set(
              pair.slice(0, separator).trim(),
              pair.slice(separator + 1).trim(),
            );
          }
        }

        const updatedCookie = Array.from(cookieMap.entries())
          .map(([name, value]) => `${name}=${value}`)
          .join("; ");

        user = await getAuthenticatedUser(updatedCookie);
      }
    } catch {
      user = null;
    }
  }

  // 3. Authentication failed.
  if (!user) {
    if (isProtected) {
      return redirectTo(request, "/");
    }

    return NextResponse.next();
  }

  const role = getRole(user);
  const isAllowed = role && allowedRoles.includes(role);

  // 4. Reject users without the required role.
  if (isProtected && !isAllowed) {
    return redirectTo(request, "/");
  }

  const adminModules = new Set(["users", "payments", "calendar", "sessions-and-logs", "audit-logs", "archives", "settings", "automations"]);
  const moduleName = pathname.split("/")[2];
  if (isProtected && role !== "admin" && adminModules.has(moduleName)) return redirectTo(request, "/panel");

  // 5. Only authorized users should be redirected away from login.
  if (isPublicAuth && isAllowed) {
    return redirectTo(request, "/panel");
  }

  // 6. Forward refreshed cookies to the browser.
  const response = NextResponse.next();

  if (refreshResponse) {
    const refreshedCookies =
      typeof refreshResponse.headers.getSetCookie === "function"
        ? refreshResponse.headers.getSetCookie()
        : [refreshResponse.headers.get("set-cookie")].filter(
            (value): value is string => Boolean(value),
          );

    for (const cookie of refreshedCookies) {
      response.headers.append("Set-Cookie", cookie);
    }
  }

  return response;
}

export const config = {
  matcher: ["/", "/panel/:path*", "/login", "/login/:path*"],
};
