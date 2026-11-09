import { Skeleton } from "@/components/ui/skeleton";

const rows = Array.from({ length: 6 });

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading products"
      className="space-y-5 px-4 py-4 md:py-6 lg:px-6"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-32 md:h-9" />
          <Skeleton className="h-4 w-72 max-w-[70vw]" />
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-80 max-w-[70vw]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-b bg-muted/20 p-4 md:px-5">
          <Skeleton className="h-10 w-full sm:max-w-md" />
          <Skeleton className="h-10 w-full sm:w-44" />
        </div>

        <div aria-busy="true" className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr>
                <th className="h-12 px-5 text-left">
                  <Skeleton className="h-4 w-20" />
                </th>
                <th className="h-12 px-5 text-left">
                  <Skeleton className="h-4 w-20" />
                </th>
                <th className="h-12 px-5 text-left">
                  <Skeleton className="h-4 w-16" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((_, index) => (
                <tr key={index} className="border-b last:border-b-0">
                  <td className="px-5 py-5">
                    <Skeleton className="h-4 w-40 max-w-[35vw]" />
                  </td>
                  <td className="px-5 py-5">
                    <Skeleton className="h-7 w-24 rounded-full" />
                  </td>
                  <td className="px-5 py-5">
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t bg-muted/10 p-4 md:px-5 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-4 w-44" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </section>
    </div>
  );
}
