import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5173";

const nextConfig: NextConfig = {
  distDir: process.env.HYOPS_BUILD_DIR ?? (process.env.HYOPS_LIVE_SERVER_STARTED === "1" ? ".next-live-fixture" : ".next"),
  allowedDevOrigins: ['192.168.0.101', '192.168.0.102', '192.168.0.103'],
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
