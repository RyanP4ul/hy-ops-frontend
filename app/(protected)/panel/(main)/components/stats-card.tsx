import Link from "next/link";
import { formatCurrency } from "@/utils/date-util";
import { ArrowUpRight, CircleDollarSign, Package, ShoppingCart, Truck, type LucideIcon } from "lucide-react";
import { useDashboard } from "../provider";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ title, value, description, Icon, href, action }: {
  title: string; value: string; description: string; Icon: LucideIcon; href: string; action: string;
}) {
  return <Link href={href} className="group flex min-w-0 flex-col rounded-xl border bg-card p-5 text-card-foreground transition-colors hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-muted-foreground">{title}</p><Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></div>
    <p className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
    <p className="mb-4 mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
    <span className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs font-medium">{action}<ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" /></span>
  </Link>;
}

export default function StatsCard() {
  const { dashboardQuery } = useDashboard();
  if (!dashboardQuery.data) return <>{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-44 w-full motion-reduce:animate-none" />)}</>;
  const data = dashboardQuery.data;
  const cashFilters = encodeURIComponent(JSON.stringify({ preset: "mtd" }));
  return <>
    <StatCard title="Monthly net cashflow" value={formatCurrency(data.revenue)} description="Receipts minus refunds / Current Manila month / All warehouses" Icon={CircleDollarSign} href={`/panel/analysis-reports?tab=payments&f=${cashFilters}`} action="Review monthly cashflow" />
    <StatCard title="Total orders" value={data.total_orders.toLocaleString()} description="All recorded orders, including cancelled / All time" Icon={ShoppingCart} href="/panel/orders" action="Review all orders" />
    <StatCard title="Active deliveries" value={data.total_active_deliveries.toLocaleString()} description="Scheduled, in transit and returning / All warehouses" Icon={Truck} href="/panel/deliveries?active=true" action="Review active deliveries" />
    <StatCard title="Pending orders" value={data.total_pending.toLocaleString()} description="Orders awaiting processing / All warehouses" Icon={Package} href="/panel/orders?status=PENDING" action="Review pending orders" />
  </>;
}
