import type { NextConfig } from "next";

const API_URL = process.env.API_URL || "http://localhost:5173";

const nextConfig: NextConfig = {
  distDir: process.env.HYOPS_LIVE_SERVER_STARTED === "1" ? ".next-live-fixture" : ".next",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
