"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm, useWatch, type ControllerRenderProps } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Minus, Plus, Search, X } from "lucide-react";
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
  const exceedsAvailable = available !== undefined && quantity > available;
  const subtotal = unitPrice != null && validQuantity ? Math.round(Number(unitPrice) * quantity * 100) / 100 : null;
  const canSave = inventoryId > 0 && available !== undefined && validQuantity && !exceedsAvailable;
  const canAdd = selectedItems.length > 0 && selectedItems.every((selection) =>
    isValidQuantity(selection.quantity) && selection.quantity <= availableForSelection(selection));
  const showItemDetails = selectedItems.length > 0;

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
    setAddError("");
  }

  function changeSelectionQuantity(value: number) {
    setSelections((current) => {
      const selection = current.get(inventoryId);
      return selection ? new Map(current).set(inventoryId, { ...selection, quantity: value }) : current;
    });
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
    if (!canAdd || isSubmitting) return;
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
    <section className="min-w-0 space-y-3" aria-label="Item catalog">
      <div className="space-y-1.5">
        <label htmlFor="order-item-search" className="text-sm font-medium">Search warehouse stock</label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input ref={searchInput} id="order-item-search" type="search" value={catalogSearch}
            onChange={event => setCatalogSearch(event.target.value)} onKeyDown={handleSearchKey}
            placeholder="Product, variant, or SKU" disabled={isSubmitting} autoComplete="off" spellCheck={false}
            enterKeyHint="search" className="h-10 pr-10 pl-9 text-base [&::-webkit-search-cancel-button]:hidden" />
          {catalogSearch && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear search" disabled={isSubmitting}
              className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => { setCatalogSearch(""); searchInput.current?.focus(); }}>
              <X aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <div role="group" aria-label="Filter by items already in the order" className="flex w-fit flex-wrap gap-1 rounded-lg border bg-background p-1">
        {catalogFilters.map(({ value, label }) => (
          <Button key={value} type="button" size="sm" variant={catalogFilter === value ? "secondary" : "ghost"}
            aria-pressed={catalogFilter === value} disabled={isSubmitting} onClick={() => setCatalogFilter(value)}>
            {label}
          </Button>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border bg-background" aria-busy={searchPending || catalog.isFetching}>
        {warehouseId <= 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Choose a warehouse in the order first.</p>
        ) : searchPending || catalog.isPending ? (
          <p role="status" className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading stock…</p>
        ) : catalog.isError ? (
          <div role="alert" className="flex items-center justify-between gap-3 p-4 text-sm">
            <span className="text-destructive">{catalog.error.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void catalog.refetch()}>Retry</Button>
          </div>
        ) : rows.length ? (
          <ul aria-label="Warehouse stock" className="max-h-60 divide-y overflow-y-auto overscroll-contain md:max-h-[min(65dvh,42rem)]">
            {rows.map(row => {
              const selection = selections.get(row.id);
              const rowAvailable = selection ? availableForSelection(selection) : availableToAdd(row);
              const quantityInOrder = draftItemsByInventoryId.get(row.id)?.quantity ?? 0;
              const title = itemName(row);
              return (
                <li key={row.id}>
                  <button type="button" aria-pressed={Boolean(selection)} disabled={isSubmitting || (!selection && rowAvailable < 1)}
                    onClick={() => selection ? removeSelection(row.id) : selectItem(row)}
                    className={cn("flex w-full items-start gap-3 px-3 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed", selection ? "bg-primary/10" : "hover:bg-muted/50")}>
                    <span aria-hidden="true" className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm border", selection && "border-primary bg-primary text-primary-foreground")}>
                      {selection && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium">{title}</span>
                      {row.product_name && row.product_name !== title && <span className="block break-words text-xs text-muted-foreground">{row.product_name}</span>}
                      <span className="mt-0.5 block break-words text-xs text-muted-foreground">{[row.sku, row.unit].filter(Boolean).join(" · ")}</span>
                      {quantityInOrder > 0 && (
                        <Badge variant="secondary" className="mt-1.5 h-auto min-h-5 max-w-full whitespace-normal tabular-nums">
                          {quantityInOrder.toLocaleString()} in this order
                        </Badge>
                      )}
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block text-sm font-medium">{row.price == null ? "—" : formatCurrency(row.price)}</span>
                      <span className={cn("mt-0.5 block text-xs", rowAvailable < 1 ? "text-destructive" : "text-muted-foreground")}>
                        {rowAvailable > 0 ? `${rowAvailable.toLocaleString()} available` : row.quantity > row.reserved ? "None left to add" : "Out of stock"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {searchTerm ? "No matches for this search and filter."
              : catalogFilter === "selected" ? "No items from this warehouse have been added to the order."
              : catalogFilter === "unselected" ? "No unselected items in this warehouse."
              : "This warehouse has no stock items to browse."}
          </p>
        )}
      </div>
      {catalog.data && catalog.data.total > catalogLimit && !searchPending && (
        <p className="text-xs text-muted-foreground">Showing {catalogLimit} of {catalog.data.total.toLocaleString()} items. Search to narrow the results.</p>
      )}
    </section>
  );

  function renderQuantityField(
    onChange: (value: number) => void,
    field?: ControllerRenderProps<OrderItem, "quantity">,
    errorMessage?: string,
  ) {
    const issue = errorMessage ?? (exceedsAvailable
      ? `Only ${available} ${available === 1 ? "unit" : "units"} available.`
      : !validQuantity ? "Enter a whole number of at least 1." : undefined);
    return (
      <Field data-invalid={Boolean(issue)} className="border-t pt-3">
        <FieldLabel htmlFor="order-item-quantity">Quantity</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Decrease quantity"
            disabled={isSubmitting || !validQuantity || quantity <= 1} onClick={() => onChange(quantity - 1)}>
            <Minus aria-hidden="true" className="size-4" />
          </Button>
          <Input name={field?.name} onBlur={field?.onBlur} ref={element => { field?.ref(element); quantityInput.current = element; }}
            id="order-item-quantity" type="number" inputMode="numeric" min={1} max={available} step={1}
            value={Number.isFinite(quantity) ? quantity : ""} onChange={event => onChange(event.target.valueAsNumber)}
            aria-invalid={Boolean(issue)} aria-describedby="order-item-quantity-message" disabled={isSubmitting}
            className="w-20 text-center text-base tabular-nums" />
          <Button type="button" variant="outline" size="icon" aria-label="Increase quantity"
            disabled={isSubmitting || !validQuantity || available === undefined || quantity >= available} onClick={() => onChange(quantity + 1)}>
            <Plus aria-hidden="true" className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" aria-label="Use maximum available quantity"
            disabled={isSubmitting || !available || quantity === available}
            onClick={() => { if (available) onChange(available); }}>Max</Button>
        </div>
        <div id="order-item-quantity-message">
          {issue ? <FieldError>{issue}</FieldError> : available !== undefined && (
            <p className="text-xs text-muted-foreground tabular-nums">{(available - quantity).toLocaleString()} left after {isInsert ? "adding" : "saving"}</p>
          )}
        </div>
      </Field>
    );
  }

  const itemDetails = inventoryId > 0 ? (
    <section ref={preview} aria-label="Selected item details" className="min-w-0 scroll-mt-4 space-y-4 rounded-xl border bg-background p-4">
      <div className="space-y-1">
        {product && product !== variant && <p className="break-words text-xs text-muted-foreground">{product}</p>}
        <h3 className="break-words text-base font-semibold">{variant || product || "Selected item"}</h3>
        {sku && <p className="break-all font-mono text-xs text-muted-foreground">{sku}</p>}
        {description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{description}</p>}
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
        {[
          ["Warehouse", warehouse],
          ["Unit of measure", activeRow?.unit],
          ["Unit price", unitPrice == null ? null : formatCurrency(unitPrice)],
          ["Weight per unit", weight],
          ["Width", width],
          ["Length", length],
        ].map(([label, value]) => value && (
          <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words font-medium tabular-nums">{value}</dd></div>
        ))}
      </dl>
      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/55 p-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">On hand</dt><dd className="font-medium tabular-nums">{activeRow?.quantity.toLocaleString() ?? "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Reserved</dt><dd className="font-medium tabular-nums">{activeRow?.reserved.toLocaleString() ?? "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{isInsert ? "Available to add" : "Available"}</dt><dd className="font-semibold tabular-nums">{available?.toLocaleString() ?? "—"}</dd></div>
      </dl>
      {isInsert && draftItem && <p className="text-xs text-muted-foreground">{draftItem.quantity.toLocaleString()} already in this order. The quantity below will be added to it.</p>}
      {isEdit && editDetails.isError && !activeRow && (
        <div role="alert" className="flex items-center justify-between gap-2 text-sm text-destructive">
          <span>{editDetails.error.message}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void editDetails.refetch()}>Retry</Button>
        </div>
      )}
      {isInsert ? renderQuantityField(changeSelectionQuantity) : (
        <Controller name="quantity" control={itemForm.control} render={({ field, fieldState }) => renderQuantityField((value) => {
          field.onChange(value);
          itemForm.clearErrors("quantity");
        }, field, fieldState.error?.message)} />
      )}
    </section>
  ) : null;

  const errorMessage = isInsert ? addError : errors.root?.message || errors.inventory_id?.message;
  const error = errorMessage && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</p>;
  const selectedTotal = selectedItems.reduce<number | null>((total, selection) => {
    const price = selectionPrice(selection);
    if (total === null || price == null || !isValidQuantity(selection.quantity)) return null;
    return total + Math.round(Number(price) * 100) * selection.quantity;
  }, 0);
  const totalDisplay = (total: number | null, label: string) => (
    <div aria-live="polite">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{total == null ? "—" : formatCurrency(total)}</p>
    </div>
  );

  return (
    <>
      <Drawer open={sub.is_open && isInsert} swipeDirection="right" onOpenChange={(open, event) => {
        if (isSubmitting) event.cancel();
        else if (!open) close();
      }}>
        <DrawerContent className={cn(
          "shadow-xl transition-[width,transform,height,opacity,filter] motion-reduce:transition-none",
          showItemDetails
            ? "data-[swipe-axis=x]:[--drawer-content-width:min(100vw,55rem)] data-[swipe-axis=x]:sm:[--drawer-content-width:min(100vw,55rem)]"
            : "data-[swipe-axis=x]:[--drawer-content-width:min(92vw,30rem)] data-[swipe-axis=x]:sm:[--drawer-content-width:min(92vw,30rem)]",
        )}
          backdropProps={{ forceRender: true, className: "bg-black/50 motion-reduce:transition-none" }}
          initialFocus={searchInput} finalFocus={() => document.getElementById("order-add-item") ?? true}>
          <DrawerHeader className="flex-row items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <div className="space-y-1">
              <DrawerTitle className="text-xl">Add item</DrawerTitle>
              <DrawerDescription>Select products and set their quantities{warehouse ? ` · ${warehouse}` : ""}.</DrawerDescription>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Close add item" disabled={isSubmitting} onClick={close}><X className="size-5" aria-hidden="true" /></Button>
          </DrawerHeader>
          <form id="order-add-item-form" noValidate onSubmit={(event) => void addSelections(event)} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/20 px-4 py-4 sm:px-6">
            {error && <div className="mb-4">{error}</div>}
            <div className={cn("grid items-start gap-4", showItemDetails && "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-5")}>
              {results}
              {showItemDetails && (
                <div className="min-w-0 space-y-3">
                  <ul aria-label="Selected items" className="max-h-40 divide-y overflow-y-auto rounded-lg border bg-background">
                    {selectedItems.map((selection) => {
                      const { row, quantity } = selection;
                      const name = row.sku || itemName(row);
                      const needsQuantity = !isValidQuantity(quantity) || quantity > availableForSelection(selection);
                      return (
                        <li key={row.id} className={cn("flex items-center gap-1 pr-2", row.id === inventoryId && "bg-primary/10")}>
                          <button type="button" disabled={isSubmitting} aria-label={`Edit quantity for ${name}`} aria-current={row.id === inventoryId ? "true" : undefined}
                            className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                            onClick={() => { setActiveId(row.id); requestAnimationFrame(() => quantityInput.current?.focus()); }}>
                            <span className="min-w-0 truncate text-sm font-medium">{itemName(row)}</span>
                            <span className={cn("shrink-0 text-xs tabular-nums", needsQuantity ? "text-destructive" : "text-muted-foreground")}>
                              {needsQuantity ? "Check quantity" : `× ${quantity.toLocaleString()}`}
                            </span>
                          </button>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${name} from selection`} disabled={isSubmitting} onClick={() => removeSelection(row.id)}>
                            <X aria-hidden="true" className="size-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                  {itemDetails}
                </div>
              )}
            </div>
          </form>
          <DrawerFooter className="flex-row flex-wrap items-center justify-between gap-3 border-t bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {totalDisplay(selectedTotal === null ? null : selectedTotal / 100, "Selected items total")}
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>Cancel</Button>
              <Button type="submit" form="order-add-item-form" disabled={!canAdd || isSubmitting}>
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
            <DialogDescription>{isDelete ? "Remove this item from the draft order?" : "Update the quantity for this item."}</DialogDescription>
          </DialogHeader>
          {isDelete ? (
            <p className="text-sm text-muted-foreground">You can add this item back before creating the order.</p>
          ) : (
            <form id="order-edit-item-form" noValidate onSubmit={(event) => void itemForm.handleSubmit(saveEdit)(event)} className="space-y-3">
              {error}
              {itemDetails}
              {totalDisplay(subtotal, "Line total")}
            </form>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>Cancel</Button>
            {isDelete ? (
              <Button type="button" variant="destructive" onClick={() => { if (sub.id !== undefined) remove(Number(sub.id)); close(); }}>Remove</Button>
            ) : (
              <Button type="submit" form="order-edit-item-form" disabled={!canSave || isSubmitting}>{isSubmitting ? "Checking stock…" : "Save quantity"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
