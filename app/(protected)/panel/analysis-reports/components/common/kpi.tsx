import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface KpiProps { label: string; value: string; hint?: string; icon: LucideIcon; delta?: number | null; loading: boolean }

export function Kpi({ label, value, hint = "", icon: Icon, delta, loading }: KpiProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-7 w-24" /> : <div className="text-2xl font-semibold">{value}</div>}
        <p className="mt-1 text-xs text-muted-foreground">
          {delta != null && <span className={delta >= 0 ? "text-emerald-600" : "text-red-600"}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}% </span>}
          {hint}
        </p>
      </CardContent>
    </Card>
  );
}
