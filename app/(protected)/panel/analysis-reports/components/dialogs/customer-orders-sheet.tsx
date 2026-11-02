"use client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Filters, OrderRow } from "../../api/contract";
import { useReport } from "../../hooks/use-report";
import { periodLabel } from "../../lib/filters";
import { manilaDay, peso } from "../../lib/format";
import { StatusBadge } from "../common/status-badge";
import { TabError } from "../common/tab-state";

interface Props { customer: { id: number; name: string } | null; filters: Filters; onClose: () => void }

/** Side panel listing one customer's orders for the current period and filters. */
export function CustomerOrdersSheet({ customer, filters, onClose }: Props) {
  const { data, loading, error } = useReport<OrderRow[]>(`/customers/${customer?.id ?? 0}/orders`, filters, { enabled: customer !== null });

  return (
    <Sheet open={customer !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{customer?.name}</SheetTitle>
          <SheetDescription>Orders in {periodLabel(filters)} matching the current filters.</SheetDescription>
        </SheetHeader>
        {/* TODO: show financial columns only to roles allowed to see them */}
        {error ? <div className="mt-4"><TabError message={error} /></div>
          : loading || !data ? <Skeleton className="mt-4 h-40 w-full" />
          : (
            <Table className="mt-4">
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.map((o) => (
                  <TableRow key={o.id}><TableCell>{o.number}</TableCell><TableCell>{manilaDay(o.at)}</TableCell><TableCell>{peso(o.total)}</TableCell><TableCell>{peso(o.balance)}</TableCell><TableCell><StatusBadge s={o.payStatus} /></TableCell></TableRow>
                ))}
                {!data.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No orders in this period.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
      </SheetContent>
    </Sheet>
  );
}
