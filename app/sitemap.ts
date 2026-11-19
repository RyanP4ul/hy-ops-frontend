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

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
