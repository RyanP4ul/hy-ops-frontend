import { useQuery } from "@tanstack/react-query";
import { fleetApi } from "../api/fleet.api";
export function ProofStatus({ stopId, onView }: { stopId: string; onView: () => void }) {
  const query = useQuery({ queryKey: ["delivery_proofs", stopId], queryFn: ({ signal }) => fleetApi.getStopProofs(stopId, signal), refetchInterval: 15000, retry: 1 });
  if (query.isPending) return <span className="text-xs text-muted-foreground">Checking proof…</span>;
  if (query.isError) return <button type="button" className="text-xs underline" onClick={() => void query.refetch()}>Proof unavailable · Retry</button>;
  if (!query.data.length) return <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Awaiting proof</span>;
  return <button type="button" className="text-xs font-medium text-primary underline" onClick={onView}>View proof</button>;
}
