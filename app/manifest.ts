import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HYOps — Inventory, Warehouse & Fleet Operations",
    short_name: "HYOps",
    description:
      "HYOps connects inventory, warehouse management, orders, payments, real-time fleet tracking, and delivery scheduling in one unified operations workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#022c22",
    icons: [
      {
        src: "/hy-ops-logo.png",
        sizes: "340x301",
        type: "image/png",
      },
      {
        src: "/favicon.ico",
        sizes: "16x16 32x32 48x48",
        type: "image/x-icon",
      },
    ],
  };
}
