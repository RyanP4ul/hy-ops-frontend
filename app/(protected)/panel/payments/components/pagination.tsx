import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getPaginationRange } from "@/utils/pagination";
import { PaymentRowType } from "@/schema/payment";
import { usePayments } from "../provider";
import { Table } from "@tanstack/react-table";

export default function PaymentPagination({
  table,
}: {
  table: Table<PaymentRowType>;
}) {
  const { page } = usePayments();
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem><PaginationPrevious aria-disabled={!table.getCanPreviousPage()} tabIndex={table.getCanPreviousPage() ? 0 : -1} onClick={() => { if (table.getCanPreviousPage()) table.previousPage(); }} className={!table.getCanPreviousPage() ? "pointer-events-none" : "cursor-pointer"} /></PaginationItem>
        {getPaginationRange(page.pageIndex, table.getPageCount()).map((pageNum, index) =>
          pageNum === "..." ? <PaginationItem key={`ellipsis-${index}`}><PaginationEllipsis /></PaginationItem> :
          <PaginationItem key={index}><PaginationLink href="#" onClick={() => table.setPageIndex(pageNum)} isActive={pageNum === page.pageIndex}>{pageNum + 1}</PaginationLink></PaginationItem>,
        )}
        <PaginationItem><PaginationNext aria-disabled={!table.getCanNextPage()} tabIndex={table.getCanNextPage() ? 0 : -1} onClick={() => { if (table.getCanNextPage()) table.nextPage(); }} className={!table.getCanNextPage() ? "pointer-events-none" : "cursor-pointer"} /></PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
