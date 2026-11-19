"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
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
  { value: "selected", label: "Selected" },
  { value: "unselected", label: "Unselected" },
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

function measurement(value: string | null | undefined, unit: string | null | undefined) {
  return unit && value != null && Number(value) > 0 ? `${Number(value).toLocaleString("en-PH")} ${unit}` : null;
}

async function verifyStock(inventoryId: number): Promise<VerifiedStock | null> {
  const response = await request("GET", `/api/inventory/details?ids=${inventoryId}`);
  if (!response.ok) throw new Error("Unable to verify warehouse stock. Try again.");
  const [stock] = (await response.json()) as VerifiedStock[];
  return stock ?? null;
}

export default function OrderItemDialog() {
  const { form, sub, setSub, getAvailableStock, warehouseQuery } = useOrders();
  const [catalogSearch, setCatalogSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("all");
  const [selectedRow, setSelectedRow] = useState<CatalogRow | null>(null);
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
  const inventoryId = useWatch({ control: itemForm.control, name: "inventory_id" });
  const quantity = useWatch({ control: itemForm.control, name: "quantity" });
  const { errors, isSubmitting } = itemForm.formState;
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
    } else if (sub.mode === DialogMode.INSERT) {
      itemForm.reset({ inventory_id: 0, quantity: 1 });
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
    queryFn: () => verifyStock(sub.id!),
    enabled: sub.is_open && isEdit && Boolean(sub.id && sub.id > 0),
  });

  const rows = catalog.data?.rows ?? [];
  const activeRow = rows.find(row => row.id === inventoryId) ?? (selectedRow?.id === inventoryId ? selectedRow : null);
  const draftItem = draftItemsByInventoryId.get(inventoryId);
  const rawAvailable = activeRow ? Math.max(0, activeRow.quantity - activeRow.reserved) : editDetails.data?.quantity;
  const available = rawAvailable != null && inventoryId > 0 ? getAvailableStock(inventoryId, rawAvailable, isEdit) : undefined;
  const warehouse = activeRow?.warehouse_name ?? warehouseQuery.data?.rows?.find(row => row.id === warehouseId)?.name;
  const variant = activeRow?.variant_name || editDetails.data?.product_variant_name || draftItem?.product_variant_name;
  const product = activeRow?.product_name;
  const sku = activeRow?.sku || editDetails.data?.product_variant_sku || draftItem?.product_variant_sku;
  const description = activeRow?.description ?? editDetails.data?.description ?? draftItem?.description;
  const unitPrice = activeRow?.price ?? editDetails.data?.price ?? draftItem?.price;
  const weight = measurement(activeRow?.weight_kg, "kg");
  const width = measurement(activeRow?.width_value, activeRow?.width_unit);
  const length = measurement(activeRow?.length_value, activeRow?.length_unit);
  const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1;
  const exceedsAvailable = available !== undefined && quantity > available;
  const subtotal = unitPrice != null && validQuantity ? Math.round(Number(unitPrice) * quantity * 100) / 100 : null;
  const canSave = inventoryId > 0 && available !== undefined && validQuantity && !exceedsAvailable;
  const showItemDetails = selectedRow !== null && inventoryId > 0;

  function availableToAdd(row: CatalogRow) {
    return getAvailableStock(row.id, Math.max(0, row.quantity - row.reserved));
  }

  function selectItem(row: CatalogRow, keyboard = false) {
    const available = availableToAdd(row);
    if (available < 1 || isSubmitting) return;
    setSelectedRow(row);
    itemForm.setValue("inventory_id", row.id);
    itemForm.clearErrors();
    const current = itemForm.getValues("quantity");
    if (!Number.isSafeInteger(current) || current < 1 || current > available) itemForm.setValue("quantity", 1);
    requestAnimationFrame(() => {
      if (keyboard) quantityInput.current?.focus();
      else preview.current?.scrollIntoView({ block: "nearest" });
    });
  }

  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (searchPending || catalog.isPending) return;
    const exact = rows.find(row => row.sku?.toLowerCase() === searchTerm.toLowerCase());
    const choice = exact ?? rows.find(row => availableToAdd(row) > 0);
    if (choice) selectItem(choice, true);
  }

  function close() {
    setSelectedRow(null);
    setCatalogSearch("");
    setSearchTerm("");
    setCatalogFilter("all");
    setSub({ is_open: false, mode: DialogMode.DEFAULT });
  }

  async function saveItem(data: OrderItem) {
    itemForm.clearErrors("root");
    try {
      const stock = await verifyStock(data.inventory_id);
      if (!stock) throw new Error("This item is no longer available.");
      const items = form.getValues("items");
      const existing = items.find(item => item.inventory_id === data.inventory_id);
      const nextQuantity = isEdit ? data.quantity : (existing?.quantity ?? 0) + data.quantity;
      const verifiedAvailable = getAvailableStock(data.inventory_id, stock.quantity, true);
      if (nextQuantity > verifiedAvailable) {
        const limit = isEdit ? verifiedAvailable : Math.max(0, verifiedAvailable - (existing?.quantity ?? 0));
        itemForm.setError("quantity", { message: `Stock changed. You can ${isEdit ? "use" : "add"} up to ${limit} units.` }, { shouldFocus: true });
        void catalog.refetch();
        if (isEdit) void editDetails.refetch();
        return;
      }
      const item = { ...stock, description: stock.description ?? "", price: Number(stock.price), quantity: nextQuantity };
      form.setValue("items", existing ? items.map(row => row.inventory_id === data.inventory_id ? item : row) : [...items, item], { shouldValidate: true });
      close();
    } catch (error) {
      itemForm.setError("root", { message: error instanceof Error ? error.message : "Unable to save item." });
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
      <div role="group" aria-label="Filter items by order selection" className="flex w-fit flex-wrap gap-1 rounded-lg border bg-background p-1">
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
              const rowAvailable = availableToAdd(row);
              const quantityInOrder = draftItemsByInventoryId.get(row.id)?.quantity ?? 0;
              const selected = inventoryId === row.id;
              const title = row.variant_name || row.product_name || row.sku || "Stock item";
              return (
                <li key={row.id}>
                  <button type="button" aria-pressed={selected} disabled={isSubmitting || rowAvailable < 1}
                    onClick={event => selectItem(row, event.detail === 0)}
                    className={cn("flex w-full items-start gap-3 px-3 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed", selected ? "bg-primary/10" : "hover:bg-muted/50")}>
                    <span aria-hidden="true" className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", selected && "border-primary bg-primary text-primary-foreground")}>
                      {selected && <Check className="size-3" />}
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
      <Controller name="quantity" control={itemForm.control} render={({ field, fieldState }) => {
        const issue = fieldState.error?.message ?? (exceedsAvailable ? `Only ${available} units available.` : !validQuantity ? "Enter a whole number of at least 1." : undefined);
        return (
          <Field data-invalid={Boolean(issue)} className="border-t pt-3">
            <FieldLabel htmlFor="order-item-quantity">Quantity</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="icon" aria-label="Decrease quantity"
                disabled={isSubmitting || !validQuantity || quantity <= 1} onClick={() => field.onChange(quantity - 1)}>
                <Minus aria-hidden="true" className="size-4" />
              </Button>
              <Input {...field} ref={element => { field.ref(element); quantityInput.current = element; }}
                id="order-item-quantity" type="number" inputMode="numeric" min={1} max={available} step={1}
                value={Number.isFinite(field.value) ? field.value : ""} onChange={event => field.onChange(event.target.valueAsNumber)}
                aria-invalid={Boolean(issue)} aria-describedby="order-item-quantity-message" disabled={isSubmitting}
                className="w-20 text-center text-base tabular-nums" />
              <Button type="button" variant="outline" size="icon" aria-label="Increase quantity"
                disabled={isSubmitting || !validQuantity || available === undefined || quantity >= available} onClick={() => field.onChange(quantity + 1)}>
                <Plus aria-hidden="true" className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" aria-label="Use maximum available quantity"
                disabled={isSubmitting || !available || quantity === available}
                onClick={() => { field.onChange(available); itemForm.clearErrors("quantity"); }}>Max</Button>
            </div>
            <div id="order-item-quantity-message">
              {issue ? <FieldError>{issue}</FieldError> : available !== undefined && (
                <p className="text-xs text-muted-foreground tabular-nums">{(available - quantity).toLocaleString()} left after {isInsert ? "adding" : "saving"}</p>
              )}
            </div>
          </Field>
        );
      }} />
    </section>
  ) : null;

  const errorMessage = errors.root?.message || errors.inventory_id?.message;
  const error = errorMessage && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</p>;
  const lineTotal = (
    <div aria-live="polite">
      <p className="text-xs text-muted-foreground">Line total</p>
      <p className="text-lg font-semibold tabular-nums">{subtotal == null ? "—" : formatCurrency(subtotal)}</p>
    </div>
  );
  const submit = (event: React.FormEvent<HTMLFormElement>) => void itemForm.handleSubmit(saveItem)(event);

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
              <DrawerDescription>{warehouse ? `Warehouse stock · ${warehouse}` : "Choose from warehouse stock."}</DrawerDescription>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Close add item" disabled={isSubmitting} onClick={close}><X className="size-5" aria-hidden="true" /></Button>
          </DrawerHeader>
          <form id="order-add-item-form" noValidate onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/20 px-4 py-4 sm:px-6">
            {error && <div className="mb-4">{error}</div>}
            <div className={cn("grid items-start gap-4", showItemDetails && "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-5")}>
              {results}
              {showItemDetails && itemDetails}
            </div>
          </form>
          <DrawerFooter className="flex-row flex-wrap items-center justify-between gap-3 border-t bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {lineTotal}
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>Cancel</Button>
              <Button type="submit" form="order-add-item-form" disabled={!canSave || isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? "Checking stock…" : "Add item"}
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
            <form id="order-edit-item-form" noValidate onSubmit={submit} className="space-y-3">
              {error}
              {itemDetails}
              {lineTotal}
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
