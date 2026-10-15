import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5173";

const protectedRoutes = ["/panel"];
const publicAuthRoutes = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );

  const isPublicAuth = publicAuthRoutes.some((route) =>
    pathname.startsWith(route),
  );

  if (!isProtected && !isPublicAuth) {
    return NextResponse.next();
  }

  const cookie = request.headers.get("cookie") ?? "";

  // 1. Check access token
  let me = await fetch(`${API_URL}/auth/me`, {
    headers: {
      cookie,
    },
    cache: "no-store",
  });

  // Already authenticated
  if (me.ok) {
    if (isPublicAuth) {
      return NextResponse.redirect(new URL("/panel", request.url));
    }

    return NextResponse.next();
  }

  // 2. Try refresh
  const refresh = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      cookie,
    },
    cache: "no-store",
  });

  if (refresh.ok) {
    // Retry authentication using the refreshed cookie
    me = await fetch(`${API_URL}/auth/me`, {
      headers: {
        cookie: refresh.headers.get("set-cookie") ?? cookie,
      },
      cache: "no-store",
    });

    if (me.ok) {
      const response = isPublicAuth
        ? NextResponse.redirect(new URL("/panel", request.url))
        : NextResponse.next();

      // Forward the refreshed cookie to the browser
      const setCookie = refresh.headers.get("set-cookie");

      if (setCookie) {
        response.headers.set("set-cookie", setCookie);
      }

      return response;
    }
  }

  // 3. Refresh failed
  if (isProtected) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/panel", "/panel/:path*", "/login"],
};
