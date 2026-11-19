import type { MetadataRoute } from "next";

const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // Fall back to default URL below
    }
  }
  return "https://hy-ops-frontend.vercel.app";
})();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/panel/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
