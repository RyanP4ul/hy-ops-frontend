import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { getPaginationRange } from "@/utils/pagination";
import { usePayments } from "../provider";
import { Table } from "@tanstack/react-table";

export default function PaymentPagination({ table }: { table: Table<import("@/schema/payment").PaymentRow> }) {
  const { page } = usePayments();
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem><PaginationPrevious onClick={() => table.previousPage()} className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : "cursor-pointer"} /></PaginationItem>
        {getPaginationRange(page.pageIndex, table.getPageCount()).map((pageNum, index) =>
          pageNum === "..." ? <PaginationItem key={`ellipsis-${index}`}><PaginationEllipsis /></PaginationItem> :
          <PaginationItem key={index}><PaginationLink href="#" onClick={() => table.setPageIndex(pageNum)} isActive={pageNum === page.pageIndex}>{pageNum + 1}</PaginationLink></PaginationItem>,
        )}
        <PaginationItem><PaginationNext onClick={() => table.nextPage()} className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : "cursor-pointer"} /></PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
