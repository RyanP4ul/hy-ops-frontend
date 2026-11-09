import { Suspense } from "react";
import { OrderWorkspace } from "./lalamove-workspace";

export default function Page() {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Loading Lalamove…</p>}><OrderWorkspace /></Suspense>;
}
