import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LalamoveWorkspace } from "./lalamove-workspace";

export const metadata: Metadata = {
  title: "HYOps - Lalamove",
  description: "Book courier deliveries and track active Lalamove shipments.",
};

function PageFallback() {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 md:px-6 lg:px-8 lg:py-7">
      <Skeleton className="h-9 w-48 motion-reduce:animate-none" />
      <Skeleton className="h-24 w-full rounded-xl motion-reduce:animate-none" />
      <Skeleton className="h-72 w-full rounded-xl motion-reduce:animate-none" />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageFallback />}>
      <LalamoveWorkspace />
    </Suspense>
  );
}
