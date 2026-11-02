"use client";
import { usePathname } from "next/navigation";
import { isPrototypeRoute } from "@/lib/prototype-routes";
export function PrototypeNotice() {
  return isPrototypeRoute(usePathname()) ? <p role="note" className="m-4 rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950">Development prototype: sample data and experimental controls. Use the main navigation for operational records.</p> : null;
}
