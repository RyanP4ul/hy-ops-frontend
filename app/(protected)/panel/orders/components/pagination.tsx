import type { Table } from "@tanstack/react-table";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { getPaginationRange } from "@/utils/pagination";
import type { OrderRow } from "@/schema/order";
import { useOrders } from "../provider";

export default function PaginationOrders({ table }: { table: Table<OrderRow & { version: number }> }) {
  const { page, ordersQuery } = useOrders();
  const count = table.getPageCount();
  const pending = ordersQuery.isFetching;
  const numbers = count ? getPaginationRange(page.pageIndex, count) : [];
  return <Pagination aria-label="Orders pagination">
    <PaginationContent className="flex-wrap">
      <PaginationItem><Button variant="outline" size="sm" disabled={pending || !table.getCanPreviousPage()} onClick={() => table.setPageIndex(0)}>First</Button></PaginationItem>
      <PaginationItem><Button variant="outline" size="sm" disabled={pending || !table.getCanPreviousPage()} onClick={() => table.previousPage()}>Previous</Button></PaginationItem>
      {numbers.map((number, index) => <PaginationItem key={index}>{number === "..." ? <PaginationEllipsis /> : <Button variant={number === page.pageIndex ? "default" : "outline"} size="sm" aria-label={`Page ${number + 1}`} aria-current={number === page.pageIndex ? "page" : undefined} disabled={pending} onClick={() => table.setPageIndex(number)}>{number + 1}</Button>}</PaginationItem>)}
      <PaginationItem><Button variant="outline" size="sm" disabled={pending || !table.getCanNextPage()} onClick={() => table.nextPage()}>Next</Button></PaginationItem>
      <PaginationItem><Button variant="outline" size="sm" disabled={pending || !table.getCanNextPage()} onClick={() => table.setPageIndex(count - 1)}>Last</Button></PaginationItem>
    </PaginationContent>
  </Pagination>;
}
