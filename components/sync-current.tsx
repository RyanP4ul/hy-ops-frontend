"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { usePageStore } from "@/stores/page-store";

export default function SyncCurrentPage() {
  const pathname = usePathname();
  const setCurrentPage = usePageStore((state) => state.setCurrentPage);

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments.at(-1);

    if (!lastSegment) {
      setCurrentPage("Dashboard");
      return;
    }

    let pageName = lastSegment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    if (pageName === "Panel") {
      pageName = "Dashboard";
    }

    setCurrentPage(pageName);
  }, [pathname, setCurrentPage]);

  return null;
}
