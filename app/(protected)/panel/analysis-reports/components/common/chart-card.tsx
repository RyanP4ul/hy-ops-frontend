import { Children, isValidElement, type ReactElement } from "react";
import { ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartCardProps { title: string; description?: string; loading: boolean; children: ReactElement }

export function ChartCard({ title, description, loading, children }: ChartCardProps) {
  const props = children.props as { data?: unknown[]; children?: React.ReactNode };
  const nestedSeries = Children.toArray(props.children).find(child => isValidElement<{ data?: unknown[] }>(child) && Array.isArray(child.props.data));
  const data = props.data ?? (isValidElement<{ data?: unknown[] }>(nestedSeries) ? nestedSeries.props.data : undefined);
  const empty = Array.isArray(data) && data.length === 0;
  const zero = Array.isArray(data) && data.length > 0 && data.every(point => point && typeof point === "object" && "value" in point && point.value === 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="h-64">
        {loading ? <Skeleton className="h-full w-full" /> : empty || zero ? <p role="status" className="flex h-full items-center justify-center text-sm text-muted-foreground">{empty ? "No data for the selected filters." : "All values are zero for the selected filters."}</p> : <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}
      </CardContent>
    </Card>
  );
}
