import { useEffect, useState } from "react";
import { useWatch } from "react-hook-form";
import { ManagementSearch } from "@/components/management-list";
import { QueryFeedback } from "@/components/query-feedback";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { parseDeliveryCoordinates, type SchedulingEntry } from "@/schema/delivery-schedule";
import { useDeliverySchedule } from "../provider";
import { DestinationEditor } from "./destination-editor";

function blockedReason(entry: SchedulingEntry) {
  if (entry.blocked_reason) return entry.blocked_reason;
  if (!entry.order_group_id && !parseDeliveryCoordinates(entry.shipping_latitude, entry.shipping_longitude)) {
    return "Confirm the destination coordinates before adding this order.";
  }
  return entry.can_schedule ? null : "This order is currently unavailable.";
}

export function OrderPicker({ onAdded }: { onAdded: () => void }) {
  const { form, orderCB, orderQuery, groupPending, addReadyOrders, availableStopSlots } = useDeliverySchedule();
  const [selected, setSelected] = useState<SchedulingEntry[]>([]);
  const scheduledIds = new Set(useWatch({ control: form.control, name: "order_ids" }));
  const remainingSlots = Math.max(0, availableStopSlots - scheduledIds.size);
  const { debouncedSearch } = orderCB;
  const rows = orderQuery.data?.rows ?? [];
  const totalPages = orderQuery.data?.totalPages ?? 1;
  const entries = rows.filter((entry) => entry.members.some((member) => !scheduledIds.has(member.id)));
  const selectedEntries = selected.map((entry) => rows.find((row) => row.id === entry.id) ?? entry);
  const pendingIds = new Set(selectedEntries.flatMap((entry) => entry.members.map((order) => order.id)));
  const selectedStops = [...pendingIds].filter((id) => !scheduledIds.has(id)).length;
  const overCapacity = selectedStops > remainingSlots;
  const hasBlockedSelection = selectedEntries.some(blockedReason);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  return (
    <>
      <ManagementSearch
        id="schedule-order-search"
        placeholder="Search ready orders"
        value={orderCB.inputValue}
        onChange={(value) => {
          orderCB.setInputValue(value);
          debouncedSearch(value);
        }}
        onClear={() => {
          debouncedSearch.cancel();
          orderCB.setInputValue("");
          orderCB.setSearchQuery("");
          orderCB.setPage(0);
        }}
      />
      <QueryFeedback query={orderQuery} label="ready orders" />
      {orderQuery.isPending && <p role="status" className="text-sm text-muted-foreground">Loading ready orders…</p>}
      {orderQuery.isSuccess && !entries.length && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No additional orders on this page.
        </p>
      )}
      {!!entries.length && (
        <ul aria-label="Orders and groups" className="max-h-[45dvh] divide-y overflow-y-auto rounded-lg border">
          {entries.map((entry) => {
            const label = entry.order_group_number || entry.order_number;
            const checked = selectedEntries.some((order) => order.id === entry.id);
            const reason = blockedReason(entry);
            return (
              <li key={entry.id} className="space-y-2 p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    disabled={groupPending || (!!reason && !checked)}
                    onCheckedChange={(next) => setSelected((current) => next
                      ? [...current, entry]
                      : current.filter((order) => order.id !== entry.id))}
                  />
                  <span className="min-w-0 break-words font-medium">
                    <span className="sr-only">Select </span>{label}
                  </span>
                </label>
                <div className="ml-7 space-y-0.5 text-xs text-muted-foreground">
                  <p>{entry.customer_name}{entry.order_group_id ? ` · ${entry.total_members} orders` : ""}</p>
                  {reason && <p>{reason}</p>}
                </div>
                {entry.order_group_id ? (
                  <details className="ml-7 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Group destinations</summary>
                    <ul className="mt-2 space-y-2">
                      {entry.members.map((member) => (
                        <li key={member.id} className="space-y-1 rounded-md border p-2">
                          <p className="font-medium text-foreground">{member.order_number}</p>
                          <p>{member.shipping_address || "Destination unavailable"}</p>
                          <DestinationEditor order={member} />
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <div className="ml-7 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{entry.shipping_address || "Destination unavailable"}</span>
                    <DestinationEditor order={entry} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {(orderCB.page > 0 || totalPages > 1) && (
        <nav aria-label="Ready order pages" className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" disabled={groupPending || orderQuery.isFetching || orderCB.page === 0} onClick={() => orderCB.setPage((page) => page - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {orderCB.page + 1} of {totalPages}</span>
          <Button type="button" variant="outline" size="sm" disabled={groupPending || orderQuery.isFetching || orderCB.page + 1 >= totalPages} onClick={() => orderCB.setPage((page) => page + 1)}>
            Next
          </Button>
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className={overCapacity ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {selectedStops} selected · {remainingSlots} {remainingSlots === 1 ? "stop" : "stops"} available
        </p>
        {selectedEntries.length > 0 && (
          <Button type="button" size="sm" variant="ghost" disabled={groupPending} onClick={() => setSelected([])}>
            Clear selection
          </Button>
        )}
      </div>
      {hasBlockedSelection && <p role="alert" className="text-sm text-destructive">One or more selected orders need attention. Review the alerts or clear your selection.</p>}
      <DialogFooter>
        <DialogClose disabled={groupPending} render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          type="button"
          disabled={groupPending || orderQuery.isFetching || selectedStops === 0 || overCapacity || hasBlockedSelection}
          onClick={async () => {
            if (await addReadyOrders(selectedEntries)) onAdded();
          }}
        >
          {groupPending ? "Adding orders…" : selectedStops === 0 ? "Add orders" : `Add ${selectedStops} ${selectedStops === 1 ? "order" : "orders"}`}
        </Button>
      </DialogFooter>
    </>
  );
}
