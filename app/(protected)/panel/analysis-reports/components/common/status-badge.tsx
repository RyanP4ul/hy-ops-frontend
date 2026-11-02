import { Badge } from "@/components/ui/badge";
import { label } from "../../lib/format";

const GOOD = ["paid", "completed", "delivered", "approved"];
const BAD = ["overdue", "failed", "cancelled", "rejected"];
const WARNING = ["unverified"];

export function StatusBadge({ s }: { s: string }) {
  const l = s.toLowerCase();
  return <Badge variant={GOOD.includes(l) ? "default" : BAD.includes(l) ? "destructive" : WARNING.includes(l) ? "outline" : "secondary"}>{label(s)}</Badge>;
}
