import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowUpRight,
  CircleDollarSign,
  Package,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { useDashboard } from "../provider";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatsCard() {
  const { dashboardQuery } = useDashboard();

  // title: string,
  //     value: string,
  //     change: string,
  //     description: string,
  //     iconClass: string,
  //     Icon: any,

  function StatCard({
    title,
    value,
    change,
    description,
    iconClass,
    Icon,
  }: {
    title: string;
    value: string;
    change: string;
    description: string;
    iconClass: string;
    Icon: any;
  }): React.ReactElement {
    return (
      <Card key={title}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>

              <p className="text-2xl font-bold tracking-tight">{value}</p>
            </div>

            <div className={`rounded-xl p-3 ${iconClass}`}>
              <Icon className="size-5" />
            </div>
          </div>

          {/* <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <ArrowUpRight className="size-3.5" />
              {stat.change}
            </span>

            <span className="text-xs text-muted-foreground">
              {stat.description}
            </span>
          </div> */}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {dashboardQuery.isLoading ? (
        <>
          <Skeleton className="h-33 w-full" />
          <Skeleton className="h-33 w-full" />
          <Skeleton className="h-33 w-full" />
          <Skeleton className="h-33 w-full" />
        </>
      ) : (
        <>
          <StatCard
            title="Revenue This Month"
            value={`₱${dashboardQuery.data?.revenue ?? 0}`}
            change="+5.2%"
            description="Compared to last month"
            iconClass="bg-blue-500/10 text-blue-600"
            Icon={CircleDollarSign}
          />

          <StatCard
            title="Total Orders"
            value={` ${dashboardQuery.data?.total_orders ?? 0}`}
            change="+5.2%"
            description="Orders recorded this month"
            iconClass="bg-violet-500/10 text-violet-600"
            Icon={ShoppingCart}
          />

          <StatCard
            title="Active Deliveries"
            value={` ${dashboardQuery.data?.total_active_deliveries ?? 0}`}
            change="+5.2%"
            description="Delivery runs currently active"
            iconClass="bg-emerald-500/10 text-emerald-600"
            Icon={Truck}
          />

          <StatCard
            title="Pending Orders"
            value={` ${dashboardQuery.data?.total_pending ?? 0}`}
            change="+5.2%"
            description="Orders awaiting processing"
            iconClass="bg-amber-500/10 text-amber-600"
            Icon={Package}
          />
        </>
      )}
    </>
  );
}
