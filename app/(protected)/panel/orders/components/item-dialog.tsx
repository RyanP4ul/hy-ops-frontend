"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm, useWatch, type ControllerRenderProps } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Check,
  Info,
  Loader2,
  Minus,
  Package,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { request } from "@/components/http";
import { DialogMode } from "@/types/dialog";
import { formatCurrency } from "@/utils/date-util";
import { cn } from "@/lib/utils";
import { orderItemSchema, type OrderItem, type OrderItemDetail } from "@/schema/order";
import { useOrders } from "../provider";

const catalogLimit = 40;
const lowStockThreshold = 5;
const catalogFilters = [
  { value: "all", label: "All" },
  { value: "selected", label: "In order" },
  { value: "unselected", label: "Not in order" },
] as const;
type CatalogFilter = (typeof catalogFilters)[number]["value"];

type CatalogRow = {
  id: number;
  product_name: string | null;
  variant_name?: string | null;
  description: string | null;
  sku: string | null;
  warehouse_name: string | null;
  unit?: string | null;
  weight_kg?: string | null;
  width_value?: string | null;
  width_unit?: string | null;
  length_value?: string | null;
  length_unit?: string | null;
  reserved: number;
  quantity: number;
  price: string | number | null;
};
type VerifiedStock = Omit<OrderItemDetail, "description" | "price"> & {
  description: string | null;
  price: string | number;
};
type Selection = {
  row: CatalogRow;
  warehouseId: number;
  quantity: number;
  verified?: VerifiedStock | null;
};

function measurement(value: string | null | undefined, unit: string | null | undefined) {
  return unit && value != null && Number(value) > 0 ? `${Number(value).toLocaleString("en-PH")} ${unit}` : null;
}

function itemName(row: CatalogRow) {
  return row.variant_name || row.product_name || row.sku || "Stock item";
}

function isValidQuantity(quantity: number) {
  return Number.isSafeInteger(quantity) && quantity >= 1;
}

async function verifyStock(inventoryIds: number[]) {
  const response = await request("GET", `/api/inventory/details?ids=${inventoryIds.join(",")}`);
  if (!response.ok) throw new Error("Unable to verify warehouse stock. Try again.");
  const stock = (await response.json()) as VerifiedStock[];
  return new Map(stock.map((row) => [row.inventory_id, row]));
}

export default function OrderItemDialog() {
  const { form, sub, setSub, getAvailableStock, warehouseQuery } = useOrders();
  const [catalogSearch, setCatalogSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("all");
  const [selections, setSelections] = useState(() => new Map<number, Selection>());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [quantityBlurred, setQuantityBlurred] = useState<Record<number, boolean>>({});
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const quantityInput = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLElement>(null);

  const warehouseId = useWatch({ control: form.control, name: "warehouse_id" });
  const draftItems = useWatch({ control: form.control, name: "items" });
  const draftItemsByInventoryId = new Map(draftItems?.map(item => [item.inventory_id, item]));
  const draftIds = catalogFilter === "all" ? "" : Array.from(draftItemsByInventoryId.keys()).join(",");
  const itemForm = useForm<OrderItem>({
    resolver: zodResolver(orderItemSchema),
    defaultValues: { inventory_id: 0, quantity: 1 },
  });
  const { remove } = useFieldArray({ control: form.control, name: "items" });
  const editInventoryId = useWatch({ control: itemForm.control, name: "inventory_id" });
  const editQuantity = useWatch({ control: itemForm.control, name: "quantity" });
  const { errors, isSubmitting: editing } = itemForm.formState;
  const isSubmitting = adding || editing;
  const isInsert = sub.mode === DialogMode.INSERT;
  const isEdit = sub.mode === DialogMode.EDIT;
  const isDelete = sub.mode === DialogMode.DELETE;

  const trimmedSearch = catalogSearch.trim();
  const searchPending = trimmedSearch !== searchTerm;
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(trimmedSearch), 220);
    return () => clearTimeout(timer);
  }, [trimmedSearch]);

  useEffect(() => {
    if (!sub.is_open) return;
    if (sub.mode === DialogMode.EDIT) {
      const item = form.getValues("items").find(row => row.inventory_id === sub.id);
      if (item) itemForm.reset(item);
    }
  }, [sub, form, itemForm]);

  const catalog = useQuery({
    queryKey: ["order_item_catalog", warehouseId, searchTerm, catalogFilter, draftIds],
    queryFn: async () => {
      if (catalogFilter === "selected" && !draftIds) return { rows: [], total: 0 };
      const params = new URLSearchParams({
        page: "0", limit: String(catalogLimit), warehouse_id: String(warehouseId), active_only: "true",
      });
      if (searchTerm) params.set("search", searchTerm);
      if (draftIds) params.set(catalogFilter === "selected" ? "ids" : "exclude_ids", draftIds);
      const response = await request("GET", `/api/inventory?${params}`);
      if (!response.ok) throw new Error("Unable to load warehouse stock.");
      const rows = (await response.json()) as CatalogRow[];
      return { rows, total: Number(response.headers.get("X-Total-Count") ?? rows.length) };
    },
    enabled: sub.is_open && (isInsert || isEdit) && warehouseId > 0,
  });
  const editDetails = useQuery({
    queryKey: ["order_item_edit_detail", sub.id],
    queryFn: async () => (await verifyStock([sub.id!])).get(sub.id!) ?? null,
    enabled: sub.is_open && isEdit && Boolean(sub.id && sub.id > 0),
  });

  const rows = catalog.data?.rows ?? [];
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const selectedItems = [...selections.values()];
  const activeSelection = (activeId === null ? undefined : selections.get(activeId)) ?? selectedItems[0];
  const inventoryId = isInsert ? activeSelection?.row.id ?? 0 : editInventoryId;
  const quantity = isInsert ? activeSelection?.quantity ?? 1 : editQuantity;
  const activeRow = rowsById.get(inventoryId) ?? (isInsert ? activeSelection?.row : undefined);
  const draftItem = draftItemsByInventoryId.get(inventoryId);
  const rawAvailable = activeRow ? Math.max(0, activeRow.quantity - activeRow.reserved) : editDetails.data?.quantity;
  const available = isInsert && activeSelection
    ? availableForSelection(activeSelection)
    : rawAvailable != null && inventoryId > 0 ? getAvailableStock(inventoryId, rawAvailable, isEdit) : undefined;
  const warehouse = activeRow?.warehouse_name ?? warehouseQuery.data?.rows?.find(row => row.id === warehouseId)?.name;
  const variant = activeRow?.variant_name || editDetails.data?.product_variant_name || draftItem?.product_variant_name;
  const product = activeRow?.product_name;
  const sku = activeRow?.sku || editDetails.data?.product_variant_sku || draftItem?.product_variant_sku;
  const description = activeRow?.description ?? editDetails.data?.description ?? draftItem?.description;
  const unitPrice = isInsert && activeSelection ? selectionPrice(activeSelection) : activeRow?.price ?? editDetails.data?.price ?? draftItem?.price;
  const weight = measurement(activeRow?.weight_kg, "kg");
  const width = measurement(activeRow?.width_value, activeRow?.width_unit);
  const length = measurement(activeRow?.length_value, activeRow?.length_unit);
  const validQuantity = isValidQuantity(quantity);
  const exceedsAvailable = available !== undefined && Number.isFinite(quantity) && quantity > available;
  const subtotal = unitPrice != null && validQuantity ? Math.round(Number(unitPrice) * quantity * 100) / 100 : null;
  const canSave = inventoryId > 0 && available !== undefined && validQuantity && !exceedsAvailable;
  const canAdd = selectedItems.length > 0 && selectedItems.every((selection) =>
    isValidQuantity(selection.quantity) && selection.quantity <= availableForSelection(selection));
  const showItemDetails = selectedItems.length > 0;
  const totalSelectedUnits = selectedItems.reduce(
    (sum, selection) => sum + (isValidQuantity(selection.quantity) ? selection.quantity : 0),
    0,
  );
  const deleteItem = isDelete && sub.id !== undefined ? draftItems?.[Number(sub.id)] : undefined;

  function availableToAdd(row: CatalogRow) {
    return getAvailableStock(row.id, Math.max(0, row.quantity - row.reserved));
  }

  function availableForSelection({ row, verified }: Selection) {
    if (verified !== undefined) return getAvailableStock(row.id, verified?.quantity ?? 0);
    return availableToAdd(rowsById.get(row.id) ?? row);
  }

  function selectionPrice({ row, verified }: Selection) {
    return verified === undefined ? (rowsById.get(row.id) ?? row).price : verified?.price;
  }

  function selectItem(row: CatalogRow) {
    if (isSubmitting) return;
    if (!selections.has(row.id) && availableToAdd(row) < 1) return;
    setSelections((current) => current.has(row.id) ? current : new Map(current).set(row.id, { row, warehouseId, quantity: 1 }));
    setActiveId(row.id);
    setAddError("");
  }

  function removeSelection(id: number) {
    setSelections((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    setQuantityBlurred((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setAddError("");
  }

  function clearAllSelections() {
    if (isSubmitting) return;
    setSelections(new Map());
    setActiveId(null);
    setQuantityBlurred({});
    setAddError("");
    searchInput.current?.focus();
  }

  function changeSelectionQuantity(value: number) {
    setSelections((current) => {
      const selection = current.get(inventoryId);
      return selection ? new Map(current).set(inventoryId, { ...selection, quantity: value }) : current;
    });
    if (isValidQuantity(value)) {
      setQuantityBlurred((current) => (current[inventoryId] ? { ...current, [inventoryId]: false } : current));
    }
    setAddError("");
  }

  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (searchPending || catalog.isPending) return;
    const exact = rows.find(row => row.sku?.toLowerCase() === searchTerm.toLowerCase());
    const choice = exact ?? rows.find(row => availableToAdd(row) > 0);
    if (choice && (selections.has(choice.id) || availableToAdd(choice) > 0)) {
      selectItem(choice);
      requestAnimationFrame(() => quantityInput.current?.focus());
    }
  }

  function close() {
    setSelections(new Map());
    setActiveId(null);
    setQuantityBlurred({});
    setAddError("");
    setCatalogSearch("");
    setSearchTerm("");
    setCatalogFilter("all");
    setSub({ is_open: false, mode: DialogMode.DEFAULT });
  }

  async function saveEdit(data: OrderItem) {
    itemForm.clearErrors("root");
    try {
      const stock = (await verifyStock([data.inventory_id])).get(data.inventory_id);
      if (!stock) throw new Error("This item is no longer available.");
      const items = form.getValues("items");
      const existing = items.find(item => item.inventory_id === data.inventory_id);
      const verifiedAvailable = getAvailableStock(data.inventory_id, stock.quantity, true);
      if (data.quantity > verifiedAvailable) {
        itemForm.setError("quantity", { message: `Stock changed. You can use up to ${verifiedAvailable} units.` }, { shouldFocus: true });
        void catalog.refetch();
        void editDetails.refetch();
        return;
      }
      const item = { ...stock, description: stock.description ?? "", price: Number(stock.price), quantity: data.quantity };
      form.setValue("items", existing ? items.map(row => row.inventory_id === data.inventory_id ? item : row) : [...items, item], { shouldValidate: true });
      close();
    } catch (error) {
      itemForm.setError("root", { message: error instanceof Error ? error.message : "Unable to save item." });
    }
  }

  async function addSelections(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!canAdd) {
      const invalidSelection = selectedItems.find(
        (selection) => !isValidQuantity(selection.quantity) || selection.quantity > availableForSelection(selection),
      );
      if (invalidSelection) {
        setActiveId(invalidSelection.row.id);
        setQuantityBlurred((current) => ({ ...current, [invalidSelection.row.id]: true }));
        requestAnimationFrame(() => quantityInput.current?.focus());
      }
      return;
    }
    if (selectedItems.some((selection) => selection.warehouseId !== warehouseId)) {
      setAddError("The warehouse changed. Reopen the item picker to load its stock.");
      return;
    }
    const draftAtSubmission = form.getValues("items");
    setAddError("");
    setAdding(true);
    try {
      const stockById = await verifyStock([...selections.keys()]);
      if (form.getValues("warehouse_id") !== warehouseId) {
        throw new Error("The warehouse changed. Reopen the item picker to load its stock.");
      }
      if (form.getValues("items") !== draftAtSubmission) {
        throw new Error("The draft changed while checking stock. Review its items and try again.");
      }
      const items = new Map(draftAtSubmission.map((item) => [item.inventory_id, item]));
      for (const { row, quantity } of selectedItems) {
        const stock = stockById.get(row.id);
        const totalQuantity = (items.get(row.id)?.quantity ?? 0) + quantity;
        if (!stock || totalQuantity > getAvailableStock(row.id, stock.quantity, true)) {
          setSelections(new Map(selectedItems.map((selection) => [selection.row.id, {
            ...selection, verified: stockById.get(selection.row.id) ?? null,
          }])));
          setActiveId(row.id);
          setAddError(stock
            ? `Stock changed for ${row.sku || itemName(row)}. Adjust the selected quantity to continue.`
            : `${row.sku || itemName(row)} is no longer available. Remove it from the selection to continue.`);
          void catalog.refetch();
          preview.current?.scrollIntoView({ block: "nearest" });
          return;
        }
        items.set(row.id, { ...stock, description: stock.description ?? "", price: Number(stock.price), quantity: totalQuantity });
      }
      form.setValue("items", [...items.values()], { shouldDirty: true, shouldValidate: true });
      close();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Unable to add the selected items.");
    } finally {
      setAdding(false);
    }
  }

  const results = (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col bg-background",
        showItemDetails && "md:border-r",
      )}
      aria-label="Item catalog"
    >
      <search
        aria-label="Search and filter warehouse stock"
        className="shrink-0 space-y-2.5 border-b bg-background px-4 py-3.5 sm:px-5"
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="order-item-search" className="text-xs font-medium text-muted-foreground">
              Search warehouse stock
            </label>
            {trimmedSearch && !searchPending && rows.length > 0 ? (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Press Enter to pick match
              </span>
            ) : catalog.data && !searchPending ? (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {catalog.data.total.toLocaleString()} {catalog.data.total === 1 ? "item" : "items"}
              </span>
            ) : null}
          </div>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchInput}
              id="order-item-search"
              type="search"
              value={catalogSearch}
              onChange={event => setCatalogSearch(event.target.value)}
              onKeyDown={handleSearchKey}
              placeholder="Search by product, variant, or SKU..."
              disabled={isSubmitting}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              className="h-10 bg-muted/30 pr-10 pl-9 text-base transition-colors focus-visible:bg-background [&::-webkit-search-cancel-button]:hidden"
            />
            {catalogSearch && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Clear search"
                disabled={isSubmitting}
                className="absolute top-1/2 right-1.5 -translate-y-1/2"
                onClick={() => { setCatalogSearch(""); searchInput.current?.focus(); }}
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Filter by items already in the order"
            className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
          >
            {catalogFilters.map(({ value, label }) => {
              const active = catalogFilter === value;
              return (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "ghost"}
                  aria-pressed={active}
                  disabled={isSubmitting}
                  onClick={() => setCatalogFilter(value)}
                  className={cn(
                    "h-7 rounded-md px-2.5 text-xs",
                    active && "bg-background font-medium text-foreground shadow-2xs hover:bg-background",
                  )}
                >
                  {label}
                </Button>
              );
            })}
          </div>
          {draftItems && draftItems.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {draftItems.length} in order
            </span>
          )}
        </div>
      </search>

      <div
        className="flex min-h-0 flex-1 flex-col"
        aria-busy={searchPending || catalog.isFetching}
      >
        {warehouseId <= 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <Warehouse aria-hidden="true" className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No warehouse selected</p>
            <p className="text-xs text-muted-foreground">Choose a warehouse in the order first.</p>
          </div>
        ) : searchPending || catalog.isPending ? (
          <div className="space-y-2 p-4">
            <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Loading stock…
            </p>
            <div aria-hidden="true" className="space-y-2">
              {[0, 1, 2, 3].map((slot) => (
                <div
                  key={slot}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/25 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 size-4 rounded bg-muted" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-36 rounded bg-muted" />
                      <div className="h-3 w-24 rounded bg-muted/70" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <div className="ml-auto h-3.5 w-16 rounded bg-muted" />
                    <div className="ml-auto h-3 w-12 rounded bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : catalog.isError ? (
          <div role="alert" className="m-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-sm">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
              <span>{catalog.error.message}</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void catalog.refetch()}>
              Retry
            </Button>
          </div>
        ) : rows.length ? (
          <ul
            aria-label="Warehouse stock"
            className={cn(
              "divide-y overflow-y-auto overscroll-contain",
              showItemDetails ? "max-h-64 md:max-h-none md:min-h-0 md:flex-1" : "min-h-0 flex-1",
            )}
          >
            {rows.map(row => {
              const selection = selections.get(row.id);
              const isActive = Boolean(selection && row.id === inventoryId);
              const rowAvailable = selection ? availableForSelection(selection) : availableToAdd(row);
              const quantityInOrder = draftItemsByInventoryId.get(row.id)?.quantity ?? 0;
              const title = itemName(row);
              const unavailable = !selection && rowAvailable < 1;
              const lowStock = rowAvailable > 0 && rowAvailable <= lowStockThreshold;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-pressed={Boolean(selection)}
                    disabled={isSubmitting || unavailable}
                    onClick={() => selection ? removeSelection(row.id) : selectItem(row)}
                    className={cn(
                      "group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5",
                      unavailable && "cursor-not-allowed bg-muted/20 opacity-55",
                      isActive
                        ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/25"
                        : selection
                          ? "bg-primary/[0.04] hover:bg-primary/[0.08]"
                          : !unavailable && "hover:bg-muted/50",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-[5px] border transition-colors",
                        selection
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background group-hover:border-foreground/40",
                      )}
                    >
                      {selection && <Check className="size-3 stroke-[2.5]" />}
                    </span>

                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block break-words text-sm leading-snug font-medium text-foreground">
                        {title}
                      </span>
                      {row.product_name && row.product_name !== title && (
                        <span className="block break-words text-xs text-muted-foreground">
                          {row.product_name}
                        </span>
                      )}
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {row.sku && (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
                            {row.sku}
                          </span>
                        )}
                        {row.unit && <span>{row.unit}</span>}
                      </span>
                      {(quantityInOrder > 0 || selection) && (
                        <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {quantityInOrder > 0 && (
                            <Badge variant="secondary" className="h-auto min-h-5 max-w-full whitespace-normal tabular-nums">
                              {quantityInOrder.toLocaleString()} in this order
                            </Badge>
                          )}
                          {selection && (
                            <Badge variant="default" className="h-auto min-h-5 tabular-nums">
                              {isValidQuantity(selection.quantity)
                                ? `+${selection.quantity.toLocaleString()} selected`
                                : "Check qty"}
                            </Badge>
                          )}
                        </span>
                      )}
                    </span>

                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block text-sm font-semibold text-foreground">
                        {row.price == null ? "—" : formatCurrency(row.price)}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs font-medium",
                          rowAvailable < 1
                            ? "text-destructive"
                            : lowStock
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-emerald-700 dark:text-emerald-400",
                        )}
                      >
                        {rowAvailable > 0
                          ? `${rowAvailable.toLocaleString()} available`
                          : row.quantity > row.reserved
                            ? "None left to add"
                            : "Out of stock"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
            <Package aria-hidden="true" className="size-8 text-muted-foreground/45" />
            <p className="max-w-xs text-sm text-muted-foreground">
              {searchTerm ? "No matches for this search and filter."
                : catalogFilter === "selected" ? "No items from this warehouse have been added to the order."
                : catalogFilter === "unselected" ? "No unselected items in this warehouse."
                : "This warehouse has no stock items to browse."}
            </p>
            {(searchTerm || catalogFilter !== "all") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCatalogSearch("");
                  setSearchTerm("");
                  setCatalogFilter("all");
                  searchInput.current?.focus();
                }}
              >
                Reset search &amp; filter
              </Button>
            )}
          </div>
        )}

        {catalog.data && catalog.data.total > catalogLimit && !searchPending && (
          <p className="shrink-0 border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground sm:px-5">
            Showing {catalogLimit} of {catalog.data.total.toLocaleString()} items. Search by name or SKU to narrow results.
          </p>
        )}
      </div>
    </section>
  );

  function renderQuantityField(
    onChange: (value: number) => void,
    field?: ControllerRenderProps<OrderItem, "quantity">,
    errorMessage?: string,
  ) {
    const isEmpty = !Number.isFinite(quantity);
    const hasBlurredCurrent = Boolean(quantityBlurred[inventoryId]);
    const rawIssue = errorMessage ?? (exceedsAvailable
      ? `Only ${available} ${available === 1 ? "unit" : "units"} available.`
      : !validQuantity
        ? (!isEmpty || hasBlurredCurrent ? "Enter a whole number of at least 1." : undefined)
        : undefined);
    const issue = rawIssue;
    const messageId = "order-item-quantity-message";
    const remainingAfter = available !== undefined && validQuantity && !exceedsAvailable
      ? available - quantity
      : null;
    const usagePercent = available && available > 0 && validQuantity
      ? Math.min(100, Math.round((quantity / available) * 100))
      : 0;
    const quickIncrements = available && available > 1
      ? [5, 10].filter((step) => available >= step)
      : [];

    return (
      <Field
        data-invalid={Boolean(issue)}
        className="rounded-xl border bg-muted/25 p-3.5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <FieldLabel htmlFor="order-item-quantity" className="text-sm font-medium text-foreground">
            Quantity
          </FieldLabel>
          {isInsert && subtotal !== null && (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              Line total: {formatCurrency(subtotal)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Decrease quantity"
              disabled={isSubmitting || !validQuantity || quantity <= 1}
              onClick={() => onChange(quantity - 1)}
              className="bg-background"
            >
              <Minus aria-hidden="true" className="size-4" />
            </Button>
            <Input
              name={field?.name}
              onBlur={() => {
                field?.onBlur();
                setQuantityBlurred((current) => ({ ...current, [inventoryId]: true }));
              }}
              ref={element => { field?.ref(element); quantityInput.current = element; }}
              id="order-item-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={available}
              step={1}
              value={Number.isFinite(quantity) ? quantity : ""}
              onChange={event => onChange(event.target.valueAsNumber)}
              aria-invalid={Boolean(issue)}
              aria-describedby={messageId}
              disabled={isSubmitting}
              className="h-9 w-24 bg-background text-center text-base font-semibold tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Increase quantity"
              disabled={isSubmitting || !validQuantity || available === undefined || quantity >= available}
              onClick={() => onChange(quantity + 1)}
              className="bg-background"
            >
              <Plus aria-hidden="true" className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {quickIncrements.map((step) => {
              const base = validQuantity ? quantity : 0;
              const target = available ? Math.min(available, base + step) : base + step;
              return (
                <Button
                  key={step}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting || !available || (validQuantity && quantity >= available)}
                  onClick={() => onChange(target)}
                  className="h-9 bg-background px-2.5 text-xs tabular-nums"
                >
                  +{step}
                </Button>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Use maximum available quantity"
              disabled={isSubmitting || !available || quantity === available}
              onClick={() => { if (available) onChange(available); }}
              className="h-9 px-2.5 text-xs tabular-nums"
            >
              Max{available ? ` (${available.toLocaleString()})` : ""}
            </Button>
          </div>
        </div>

        <div id={messageId} className="space-y-1.5">
          {issue ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldError className="flex items-center gap-1.5 text-xs">
                <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
                <span>{issue}</span>
              </FieldError>
              {exceedsAvailable && available !== undefined && available >= 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => onChange(available)}
                >
                  Set to {available.toLocaleString()}
                </Button>
              )}
            </div>
          ) : remainingAfter !== null ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                <span>
                  {remainingAfter.toLocaleString()} left after {isInsert ? "adding" : "saving"}
                </span>
                <span>
                  {quantity.toLocaleString()} / {available?.toLocaleString()}
                </span>
              </div>
              <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] motion-reduce:transition-none",
                    usagePercent >= 90 ? "bg-amber-600 dark:bg-amber-400" : "bg-primary",
                  )}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
          ) : isEmpty ? (
            <p className="text-xs text-muted-foreground">
              Enter a whole number{available ? ` between 1 and ${available.toLocaleString()}` : " of at least 1"}.
            </p>
          ) : null}
        </div>
      </Field>
    );
  }

  const specs = [
    ["Warehouse", warehouse],
    ["Unit of measure", activeRow?.unit],
    ["Weight per unit", weight],
    ["Width", width],
    ["Length", length],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const itemDetails = inventoryId > 0 ? (
    <section
      ref={preview}
      aria-label="Selected item details"
      className="min-w-0 scroll-mt-4 space-y-4 rounded-xl border bg-background p-4 shadow-2xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {product && product !== variant && (
            <p className="break-words text-xs font-medium text-muted-foreground">{product}</p>
          )}
          <h3 className="break-words text-base leading-snug font-semibold text-foreground">
            {variant || product || "Selected item"}
          </h3>
          {sku && (
            <p className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all text-muted-foreground">
              {sku}
            </p>
          )}
        </div>
        {unitPrice != null && (
          <div className="shrink-0 text-right tabular-nums">
            <p className="text-sm font-semibold text-foreground">{formatCurrency(unitPrice)}</p>
            <p className="text-[11px] text-muted-foreground">
              per {activeRow?.unit || "unit"}
            </p>
          </div>
        )}
      </div>

      {isInsert && draftItem && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-foreground/70" />
          <p>
            <span className="font-medium text-foreground tabular-nums">{draftItem.quantity.toLocaleString()}</span>{" "}
            already in this order. The quantity below will be added to it
            {validQuantity ? (
              <> (new total: <span className="font-medium text-foreground tabular-nums">{(draftItem.quantity + quantity).toLocaleString()}</span>)</>
            ) : null}.
          </p>
        </div>
      )}

      {isEdit && editDetails.isError && !activeRow && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <span>{editDetails.error.message}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void editDetails.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {isInsert ? renderQuantityField(changeSelectionQuantity) : (
        <Controller name="quantity" control={itemForm.control} render={({ field, fieldState }) => renderQuantityField((value) => {
          field.onChange(value);
          itemForm.clearErrors("quantity");
        }, field, fieldState.error?.message)} />
      )}

      <dl className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/35 p-3 text-sm">
        <div>
          <dt className="text-[11px] text-muted-foreground">On hand</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{activeRow?.quantity.toLocaleString() ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Reserved</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{activeRow?.reserved.toLocaleString() ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">{isInsert ? "Available to add" : "Available"}</dt>
          <dd className={cn(
            "mt-0.5 font-semibold tabular-nums",
            available !== undefined && available < 1
              ? "text-destructive"
              : available !== undefined && available <= lowStockThreshold
                ? "text-amber-700 dark:text-amber-400"
                : "text-foreground",
          )}>
            {available?.toLocaleString() ?? "—"}
          </dd>
        </div>
      </dl>

      {(specs.length > 0 || description) && (
        <div className="space-y-3 border-t pt-3">
          {specs.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {specs.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="break-words font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {description && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground/85">{description}</p>
            </div>
          )}
        </div>
      )}
    </section>
  ) : null;

  const errorMessage = isInsert ? addError : errors.root?.message || errors.inventory_id?.message;
  const error = errorMessage && (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 flex-1 leading-snug">{errorMessage}</p>
    </div>
  );
  const selectedTotal = selectedItems.reduce<number | null>((total, selection) => {
    const price = selectionPrice(selection);
    if (total === null || price == null || !isValidQuantity(selection.quantity)) return null;
    return total + Math.round(Number(price) * 100) * selection.quantity;
  }, 0);
  const totalDisplay = (total: number | null, label: string, meta?: string) => (
    <div aria-live="polite" className="min-w-0">
      <p className="text-xs text-muted-foreground">
        {label}
        {meta ? <span className="tabular-nums"> · {meta}</span> : null}
      </p>
      <p className="text-lg font-semibold tracking-tight tabular-nums">
        {total == null ? "—" : formatCurrency(total)}
      </p>
    </div>
  );

  return (
    <>
      <Drawer open={sub.is_open && isInsert} swipeDirection="right" onOpenChange={(open, event) => {
        if (isSubmitting) event.cancel();
        else if (!open) close();
      }}>
        <DrawerContent className={cn(
          "shadow-2xl transition-[width,transform,height,opacity,filter] motion-reduce:transition-none",
          showItemDetails
            ? "data-[swipe-axis=x]:[--drawer-content-width:min(100vw,58rem)] data-[swipe-axis=x]:sm:[--drawer-content-width:min(100vw,58rem)]"
            : "data-[swipe-axis=x]:[--drawer-content-width:min(94vw,31rem)] data-[swipe-axis=x]:sm:[--drawer-content-width:min(94vw,31rem)]",
        )}
          backdropProps={{ forceRender: true, className: "bg-black/50 motion-reduce:transition-none" }}
          initialFocus={searchInput} finalFocus={() => document.getElementById("order-add-item") ?? true}>
          <DrawerHeader className="flex-row items-center justify-between gap-3 border-b bg-background px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/50 text-foreground"
              >
                <PackagePlus className="size-4.5" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <DrawerTitle className="text-lg font-semibold tracking-tight">Add item</DrawerTitle>
                <DrawerDescription className="truncate text-xs sm:text-sm">
                  Select products and set quantities{warehouse ? ` · ${warehouse}` : ""}
                </DrawerDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close add item"
              disabled={isSubmitting}
              onClick={close}
              className="shrink-0"
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </DrawerHeader>

          <form
            id="order-add-item-form"
            noValidate
            onSubmit={(event) => void addSelections(event)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20"
          >
            {error && (
              <div className="shrink-0 border-b bg-background px-4 py-3 sm:px-5">
                {error}
              </div>
            )}

            <div
              className={cn(
                "min-h-0 flex-1",
                showItemDetails
                  ? "flex flex-col overflow-y-auto overscroll-contain md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:overflow-hidden"
                  : "flex flex-col overflow-hidden",
              )}
            >
              {results}

              {showItemDetails && (
                <div className="min-w-0 space-y-3.5 border-t bg-muted/25 p-4 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:border-t-0 sm:p-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase tabular-nums">
                        Selected items ({selectedItems.length})
                      </p>
                      {selectedItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={isSubmitting}
                          onClick={clearAllSelections}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 aria-hidden="true" className="size-3" />
                          Clear all
                        </Button>
                      )}
                    </div>

                    <ul
                      aria-label="Selected items"
                      className="max-h-44 divide-y overflow-y-auto overscroll-contain rounded-xl border bg-background shadow-2xs"
                    >
                      {selectedItems.map((selection) => {
                        const { row, quantity: selQty } = selection;
                        const name = row.sku || itemName(row);
                        const isCurrent = row.id === inventoryId;
                        const needsQuantity = !isValidQuantity(selQty) || selQty > availableForSelection(selection);
                        const selPrice = selectionPrice(selection);
                        const selSubtotal = selPrice != null && isValidQuantity(selQty)
                          ? Math.round(Number(selPrice) * selQty * 100) / 100
                          : null;
                        return (
                          <li
                            key={row.id}
                            className={cn(
                              "flex items-center gap-1 pr-1.5 transition-colors",
                              isCurrent && "bg-primary/[0.07]",
                            )}
                          >
                            <button
                              type="button"
                              disabled={isSubmitting}
                              aria-label={`Edit quantity for ${name}`}
                              aria-current={isCurrent ? "true" : undefined}
                              className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                              onClick={() => {
                                setActiveId(row.id);
                                requestAnimationFrame(() => quantityInput.current?.focus());
                              }}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">
                                  {itemName(row)}
                                </span>
                                {row.sku && (
                                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                                    {row.sku}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-right tabular-nums">
                                {needsQuantity ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                                    <AlertCircle aria-hidden="true" className="size-3.5" />
                                    Check quantity
                                  </span>
                                ) : (
                                  <>
                                    <span className="block text-xs font-semibold text-foreground">
                                      × {selQty.toLocaleString()}
                                    </span>
                                    {selSubtotal !== null && selectedItems.length > 1 && (
                                      <span className="block text-[11px] text-muted-foreground">
                                        {formatCurrency(selSubtotal)}
                                      </span>
                                    )}
                                  </>
                                )}
                              </span>
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${name} from selection`}
                              disabled={isSubmitting}
                              onClick={() => removeSelection(row.id)}
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <X aria-hidden="true" className="size-4" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {itemDetails}
                </div>
              )}
            </div>
          </form>

          <DrawerFooter className="flex-row flex-wrap items-center justify-between gap-3 border-t bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            {totalDisplay(
              selectedItems.length === 0 ? null : selectedTotal === null ? null : selectedTotal / 100,
              "Selected items total",
              selectedItems.length > 0 && totalSelectedUnits > 0
                ? `${totalSelectedUnits.toLocaleString()} ${totalSelectedUnits === 1 ? "unit" : "units"}`
                : undefined,
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="lg" disabled={isSubmitting} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" size="lg" form="order-add-item-form" disabled={!canAdd || isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? "Checking stock…" : selectedItems.length > 1 ? `Add ${selectedItems.length} items` : "Add item"}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Dialog open={sub.is_open && (isEdit || isDelete)} onOpenChange={(open, event) => {
        if (isSubmitting) event.cancel();
        else if (!open) close();
      }}>
        <DialogContent className={isDelete ? "sm:max-w-md" : "sm:max-w-xl"} initialFocus={isEdit ? quantityInput : undefined}>
          <DialogHeader>
            <DialogTitle>{isDelete ? "Remove item" : "Edit item"}</DialogTitle>
            <DialogDescription>
              {isDelete ? "Remove this item from the draft order?" : "Update the quantity for this item."}
            </DialogDescription>
          </DialogHeader>
          {isDelete ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              {deleteItem && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-foreground">
                  <p className="font-medium">{deleteItem.product_variant_name || deleteItem.product_variant_sku}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {deleteItem.product_variant_sku} · Qty {deleteItem.quantity.toLocaleString()}
                  </p>
                </div>
              )}
              <p>You can add this item back before creating the order.</p>
            </div>
          ) : (
            <form id="order-edit-item-form" noValidate onSubmit={(event) => void itemForm.handleSubmit(saveEdit)(event)} className="space-y-3">
              {error}
              {itemDetails}
              <div className="rounded-lg border bg-muted/25 px-3.5 py-2.5">
                {totalDisplay(subtotal, "Line total")}
              </div>
            </form>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>Cancel</Button>
            {isDelete ? (
              <Button type="button" variant="destructive" onClick={() => { if (sub.id !== undefined) remove(Number(sub.id)); close(); }}>Remove</Button>
            ) : (
              <Button type="submit" form="order-edit-item-form" disabled={!canSave || isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? "Checking stock…" : "Save quantity"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
