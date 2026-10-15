import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationEllipsis,
  PaginationNext,
} from "@/components/ui/pagination";
import { getPaginationRange } from "@/utils/pagination";
import { useUser } from "../provider";

export default function PaginationUser({ table }: { table: any }) {
  const { page } = useUser();
  const pageNumbers = getPaginationRange(page.pageIndex, table.getPageCount());

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            aria-label="Go to first page"
            size="default"
            className={`gap-1 px-2.5 sm:pl-2.5 ${
              !table.getCanPreviousPage()
                ? "cursor-not-allowed"
                : "cursor-pointer"
            }`}
            onClick={() => table.setPageIndex(0)}
          >
            <span className="hidden sm:block">First</span>
          </PaginationLink>
        </PaginationItem>

        <PaginationItem>
          <PaginationPrevious
            onClick={() => table.previousPage()}
            className={
              !table.getCanPreviousPage()
                ? "cursor-not-allowed"
                : "cursor-pointer"
            }
          />
        </PaginationItem>

        {pageNumbers.map((pageNum, index) =>
          pageNum === "..." ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={index}>
              <PaginationLink
                onClick={() => table.setPageIndex(pageNum)}
                href="#"
                isActive={pageNum === page.pageIndex}
              >
                {pageNum + 1}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            onClick={() => table.nextPage()}
            className={
              !table.getCanNextPage() ? "cursor-not-allowed" : "cursor-pointer"
            }
          />
        </PaginationItem>

        <PaginationItem>
          <PaginationLink
            aria-label="Go to first page"
            size="default"
            className={`gap-1 px-2.5 sm:pl-2.5 ${
              !table.getCanNextPage() ? "cursor-not-allowed" : "cursor-pointer"
            }`}
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          >
            <span className="hidden sm:block">Last</span>
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
