"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { PaginatedCombobox } from "@/components/paginated-combobox";
import { Button } from "@/components/ui/button";
import { api } from "../lib/api";
import type { PickupWarehouse } from "../types";
import { warehouseAddress } from "./shared";

export type PickupFeedback = {
  kind: "success" | "error";
  message: string;
} | null;

export function PickupWarehouseSelector({
  orderId,
  warehouse,
  locked,
  busy,
  saving,
  feedback,
  onSave,
}: {
  orderId: number;
  warehouse: PickupWarehouse;
  locked: boolean;
  busy: boolean;
  saving: boolean;
  feedback: PickupFeedback;
  onSave: (id: number) => void;
}) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PickupWarehouse | null>(warehouse);

  const query = useQuery({
    queryKey: ["lalamove", "pickup-warehouses", orderId, page, search],
    queryFn: () =>
      api<{ rows: PickupWarehouse[]; total: number }>(
        "GET",
        `/context/${orderId}/warehouses?page=${page}&search=${encodeURIComponent(search)}`,
      ),
    enabled: !locked,
  });

  const preview = selected?.id === warehouse.id ? warehouse : selected;
  const missingPhone = !preview?.phone_number?.trim();
  const unchanged = !selected || selected.id === warehouse.id;

  return (
    <div className="space-y-3.5">
      <form
        aria-label="Pickup warehouse"
        aria-busy={saving}
        className="space-y-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected) onSave(selected.id);
        }}
      >
        <PaginatedCombobox<PickupWarehouse>
          id="lalamove-pickup-warehouse"
          label="Pickup warehouse"
          value={selected ? String(selected.id) : null}
          selectedLabel={preview?.name || ""}
          options={query.data?.rows || []}
          getOptionValue={(item) => String(item.id)}
          renderOption={(item) => (
            <div className="min-w-0 py-1">
              <p className="text-sm font-medium">{item.name}</p>
              <p className="break-words text-xs text-muted-foreground">
                {warehouseAddress(item)}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.phone_number || "Phone missing"}
              </p>
            </div>
          )}
          onValueChange={(_value, option) => setSelected(option)}
          onSearchChange={setSearch}
          page={page}
          totalPages={Math.ceil((query.data?.total || 0) / 10)}
          onPageChange={setPage}
          isLoading={query.isFetching}
          disabled={busy || locked}
          required
          placeholder="Search warehouses..."
          emptyMessage="No matching warehouses."
          error={
            query.error ? (
              <div role="alert" className="space-y-2 text-xs text-destructive">
                <p>{query.error.message}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => void query.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : undefined
          }
        />

        {preview && (
          <div className="rounded-lg bg-muted/40 px-3.5 py-2.5 text-xs">
            <p className="font-medium text-foreground">{preview.name}</p>
            <p className="mt-0.5 break-words text-muted-foreground">
              {warehouseAddress(preview) || "Address missing"}
            </p>
            <p className="mt-1 text-muted-foreground">
              Phone:{" "}
              <span
                className={
                  missingPhone
                    ? "font-medium text-amber-700 dark:text-amber-300"
                    : "text-foreground"
                }
              >
                {preview.phone_number || "Not set"}
              </span>
            </p>
          </div>
        )}

        {missingPhone && (
          <p
            role="status"
            className="text-xs text-amber-800 dark:text-amber-300"
          >
            Add a phone number in{" "}
            <Link
              href="/panel/warehouses"
              className="font-medium underline underline-offset-2"
            >
              Warehouses
            </Link>{" "}
            before booking.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {locked ? (
            <p className="text-xs text-muted-foreground">
              Locked while scheduled or active.
            </p>
          ) : (
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={busy || unchanged || missingPhone}
            >
              {saving && (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              )}
              {saving ? "Saving..." : "Save warehouse"}
            </Button>
          )}

          <Link
            href="/panel/warehouses"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Edit warehouses
          </Link>
        </div>
      </form>

      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
            feedback.kind === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          }`}
        >
          {feedback.kind === "success" && (
            <Check className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          {feedback.message}
        </p>
      )}
    </div>
  );
}
