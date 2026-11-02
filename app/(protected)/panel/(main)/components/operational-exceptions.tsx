"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Clock3, Package, PackageOpen, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Exceptions = { overdueDeliveries: number; pendingOrders: number; lowStock: number; outOfStock: number };

export function OperationalExceptions() {
  const query = useQuery<Exceptions>({
    queryKey: ["dashboard_query", "exceptions"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/exceptions");
      if (!response.ok) throw new Error("Operational summary unavailable");
      return response.json();
    },
    refetchInterval: 30_000,
  });
  const items = [
    { label: "Overdue deliveries", key: "overdueDeliveries", href: "/panel/deliveries?status=scheduled&overdue=true", Icon: Clock3 },
    { label: "Pending orders", key: "pendingOrders", href: "/panel/orders?status=PENDING", Icon: Package },
    { label: "Low-stock items", key: "lowStock", href: "/panel/inventory?stock_status=Low", Icon: TriangleAlert },
    { label: "Out-of-stock items", key: "outOfStock", href: "/panel/inventory?stock_status=Out", Icon: PackageOpen },
  ] as const;
  return <section aria-labelledby="dashboard-attention-heading" className="min-w-0 rounded-xl border bg-background">
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5"><div><h2 id="dashboard-attention-heading" className="text-base font-semibold">Needs attention</h2><p className="mt-1 text-sm text-muted-foreground">Open a category to review it. Counts cover all warehouses.</p></div><p className="text-xs text-muted-foreground">Delivery times use Manila time</p></div>
    {query.isError && <div role="alert" className="mx-5 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm"><p>Operational summary unavailable.{query.data ? " Showing the last loaded counts." : " Retry to load the current counts."}</p><Button type="button" variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>Retry summary</Button></div>}
    <div className="grid min-w-0 divide-y border-t sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4" aria-busy={query.isFetching}>
      {items.map(({ label, key, href, Icon }) => {
        const value = query.data?.[key];
        return <Link key={key} href={href} className="group flex min-w-0 items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring sm:odd:border-r lg:[&:not(:last-child)]:border-r">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${value !== undefined && value > 0 ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}><Icon aria-hidden="true" className="size-4" /></span>
          <div className="min-w-0 flex-1"><p className="text-xs leading-relaxed text-muted-foreground">{label}</p>{query.isPending ? <Skeleton aria-label={`Loading ${label.toLowerCase()}`} className="mt-1 h-6 w-10 motion-reduce:animate-none" /> : <p className="mt-0.5 text-xl font-semibold tabular-nums">{value?.toLocaleString() ?? "Unavailable"}</p>}</div>
          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
        </Link>;
      })}
    </div>
  </section>;
}
