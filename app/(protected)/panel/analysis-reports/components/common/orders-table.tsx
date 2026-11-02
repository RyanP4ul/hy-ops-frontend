"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrderRow } from "../../api/contract";
import { manilaDay, peso } from "../../lib/format";
import { StatusBadge } from "./status-badge";

const PAGE_SIZE = 8;

/** Searchable, sortable, paged orders table. Works on the rows the API already returned for the period. */
export function OrdersTable({ rows }: { rows: OrderRow[] }) {
  const [q, setQ] = useState(""), [page, setPage] = useState(0), [desc, setDesc] = useState(true);
  const list = rows
    .filter((o) => `${o.number} ${o.customer}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => desc
      ? (b.total ?? -1) - (a.total ?? -1)
      : (a.total ?? Number.MAX_SAFE_INTEGER) - (b.total ?? Number.MAX_SAFE_INTEGER));
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const visible = list.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Orders</CardTitle>
        <Input className="sm:w-64" placeholder="Search order or customer" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Items</TableHead>
              <TableHead><button className="font-medium" onClick={() => setDesc(!desc)}>Total {desc ? "↓" : "↑"}</button></TableHead>
              <TableHead>Balance</TableHead><TableHead>Payment</TableHead><TableHead>Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((o) => (
              <TableRow key={o.id}>
                <TableCell>{o.number}</TableCell><TableCell>{manilaDay(o.at)}</TableCell><TableCell>{o.customer}</TableCell><TableCell>{o.itemCount}</TableCell>
                <TableCell>{peso(o.total)}</TableCell><TableCell>{peso(o.balance)}</TableCell>
                <TableCell><StatusBadge s={o.payStatus} /></TableCell><TableCell><StatusBadge s={o.status} /></TableCell>
              </TableRow>
            ))}
            {!list.length && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No orders match these filters. Clear filters or widen the date range.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>{list.length} orders</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <span>{page + 1} / {pages}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
