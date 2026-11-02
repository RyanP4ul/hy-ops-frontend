"use client";

import { QueryFeedback } from "@/components/query-feedback";
import { formatCurrency } from "@/utils/date-util";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { Loader2 } from "lucide-react";
import { ToastSubmit, ToastValidationError } from "@/components/util";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inventorySchema, InventoryType } from "@/schema/inventory";
import { Input } from "@/components/ui/input";
import { useInventory } from "../provider";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { PaginatedCombobox } from "@/components/paginated-combobox";
import { useEffect, useRef, useState } from "react";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";

export default function DialogPage() {
  const { state, dispatch } = useModal();
  const [deleting, setDeleting] = useState(false);
  const {
    setVariantWarehouseId,
    inventoryQuery,
    inventoryDetail,
    warehouseQuery,
    productVariantQuery,
    inventoryDetailQuery,
    warehouseCB,
    productVariantCB,
    createInventory,
    updateInventory,
    deleteInventory,
  } = useInventory();

  const form = useForm<InventoryType>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      warehouse_id: 0,
      product_variant_id: 0,
      quantity: 0,
      reserved: 0,
    },
  });

  const selectedWarehouseId = useWatch({ control: form.control, name: "warehouse_id" });
  const initialized = useRef<string | null>(null);
  useEffect(() => {
    if (!state.isOpen) { initialized.current = null; setVariantWarehouseId(0); return; }
    const key = `${state.mode}:${inventoryDetail.id}:${inventoryDetail.version}`;
    if (initialized.current === key) return;
    if (state.mode === DialogMode.EDIT && (inventoryDetailQuery.isFetching || !inventoryDetailQuery.data)) return;
    initialized.current = key;
    if (state.mode === DialogMode.EDIT && inventoryDetail.id > 0) {
      form.reset({
        warehouse_id: inventoryDetailQuery.data?.warehouse_id ?? 0,
        product_variant_id: inventoryDetailQuery.data?.product_variant_id ?? 0,
        quantity: inventoryDetailQuery.data?.quantity ?? 0,
        reserved: inventoryDetailQuery.data?.reserved ?? 0,
      });

      if (warehouseQuery.data) {
        warehouseCB.setInputValue(
          inventoryDetailQuery.data?.warehouse_name ?? "",
        );
      }

      productVariantCB.setInputValue(inventoryDetailQuery.data?.product_variant_sku ?? "");
    } else {
      setVariantWarehouseId(0);
      productVariantCB.setPage(0);
      productVariantCB.setSearchQuery("");
      form.reset({
        warehouse_id: 0,
        product_variant_id: 0,
        quantity: 0,
      });

      warehouseCB.setInputValue("");
      productVariantCB.setInputValue("");
    }
  }, [state.isOpen, state.mode, inventoryDetail.id, inventoryDetail.version, inventoryDetailQuery.isFetching, inventoryDetailQuery.data, form, warehouseCB, productVariantCB, warehouseQuery.data, productVariantQuery.data, setVariantWarehouseId]);

  async function onSubmit(data: InventoryType) {
    form.clearErrors("root");
    try {
    ToastSubmit(data);

    if (state.mode === DialogMode.EDIT && inventoryDetail.id > 0) {
      await updateInventory(inventoryDetail.id, {
        ...data,
        version: inventoryDetail.version,
      });
    } else {
      await createInventory(data);
    }

    inventoryQuery.refetch();

    dispatch({ type: "CLOSE" });
    } catch (error) {
      form.setError("root", { message: error instanceof Error ? error.message : "Unable to save inventory. Try again." });
    }
  }

  async function onDelete() {
    if (deleting) return;
    setDeleting(true);
    form.clearErrors("root");
    try {
      await deleteInventory();
      await inventoryQuery.refetch();
      dispatch({ type: "CLOSE" });
    } catch (error) {
      form.setError("root", { message: error instanceof Error ? error.message : "Unable to delete inventory. Try again." });
    } finally {
      setDeleting(false);
    }
  }

  const formContent = (
      <>
        <form
          id="form"
          onSubmit={form.handleSubmit(onSubmit, (error) =>
            ToastValidationError(error),
          )}
        >
          {state.mode === DialogMode.EDIT && <QueryFeedback query={inventoryDetailQuery} label="inventory details" />}
          <p className="mb-4 text-sm text-muted-foreground">Reservations are managed by orders. On-hand quantity must cover reserved units.</p>
          {form.formState.errors.root && <p role="alert" className="mb-3 text-sm text-destructive">{form.formState.errors.root.message}</p>}
          <FieldGroup className="grid grid-cols-1 items-center gap-4">
            <Controller
              name="warehouse_id"
              control={form.control}
              render={({ field, fieldState }) => (
                <Combobox
                  disabled={state.mode === DialogMode.EDIT}
                  open={warehouseCB.open}
                  onOpenChange={(open) => warehouseCB.setOpen(open)}
                  value={field.value && field.value > 0 ? String(field.value) : null}
                  onValueChange={(value) => {
                    const selectedWarehouse = warehouseQuery.data?.rows?.find(
                      (warehouse) => warehouse.id === Number(value),
                    );

                    warehouseCB.setInputValue(selectedWarehouse?.name ?? "");
                    if (Number(value) !== field.value) {
                      form.setValue("product_variant_id", 0);
                      productVariantCB.setInputValue("");
                      productVariantCB.setSearchQuery("");
                      productVariantCB.setPage(0);
                      productVariantCB.setOpen(false);
                      setVariantWarehouseId(value ? Number(value) : 0);
                    }

                    field.onChange(value ? Number(value) : null);
                  }}
                >
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="warehouse-name">
                      Warehouse<span className="text-destructive">*</span>
                    </FieldLabel>

                    <ComboboxInput
                      id="warehouse-name"
                    placeholder="Select warehouse name..."
                      value={warehouseCB.inputValue}
                      disabled={state.mode === DialogMode.EDIT || warehouseQuery.isFetching}
                      aria-invalid={fieldState.invalid}
                      readOnly
                    />
                    <ComboboxContent>
                      <ComboboxList>
                        {warehouseQuery.data?.rows?.map((productVariant) => (
                          <ComboboxItem
                            key={productVariant.id}
                            value={String(productVariant.id)}
                          >
                            <Item size="xs" className="p-0">
                              <ItemContent>
                                <ItemTitle className="whitespace-nowrap">
                                  ({productVariant.id}) {productVariant.name}
                                </ItemTitle>
                                
                              </ItemContent>
                            </Item>
                          </ComboboxItem>
                        ))}

                        {warehouseQuery.isFetching && (
                          <div className="px-2 py-1 text-xs text-muted-foreground">
                            Loading...
                          </div>
                        )}

                        {!warehouseQuery.isFetching &&
                          warehouseQuery.data?.rows?.length === 0 && (
                            <ComboboxEmpty>No found.</ComboboxEmpty>
                          )}
                      </ComboboxList>

                      <div className="flex items-center justify-between border-t p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            warehouseCB.page <= 0 || warehouseQuery.isFetching
                          }
                          onClick={() => warehouseCB.setPage((p) => p - 1)}
                        >
                          Previous
                        </Button>

                        <span className="text-muted-foreground text-xs">
                          {warehouseCB.page + 1} / {warehouseCB.totalPages}
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            warehouseCB.page + 1 >= warehouseCB.totalPages ||
                            warehouseQuery.isFetching
                          }
                          onClick={() => {
                            warehouseCB.setPage((p) => p + 1);
                          }}
                        >
                          Next
                        </Button>
                      </div>
                    </ComboboxContent>

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                </Combobox>
              )}
            />
            {state.mode === DialogMode.INSERT && selectedWarehouseId > 0 && <QueryFeedback query={productVariantQuery} label="available product variants" />}
            <Controller
              name="product_variant_id"
              control={form.control}
              render={({ field, fieldState }) => (
                <PaginatedCombobox
                  key={selectedWarehouseId}
                  id="product-variant"
                  label="Product Variant"
                  required
                  disabled={state.mode === DialogMode.EDIT || !selectedWarehouseId || productVariantQuery.isError}
                  value={field.value && field.value > 0 ? String(field.value) : null}
                  selectedLabel={productVariantCB.inputValue}
                  options={productVariantQuery.data?.rows ?? []}
                  getOptionValue={(productVariant) => String(productVariant.id)}
                  renderOption={(productVariant) => (
                    <Item size="xs" className="p-0">
                      <ItemContent>
                        <ItemTitle className="whitespace-nowrap">
                          ({productVariant.id}) {productVariant.sku}
                        </ItemTitle>
                        <ItemDescription>
                          {formatCurrency(productVariant.price)}
                        </ItemDescription>
                      </ItemContent>
                    </Item>
                  )}
                  onValueChange={(value, selectedProductVariant) => {
                    productVariantCB.setInputValue(
                      selectedProductVariant?.sku ?? "",
                    );
                    field.onChange(value ? Number(value) : null);
                  }}
                  onSearchChange={productVariantCB.setSearchQuery}
                  page={productVariantCB.page}
                  totalPages={Math.max(
                    1,
                    Math.ceil((productVariantQuery.data?.total ?? 0) / 10),
                  )}
                  onPageChange={productVariantCB.setPage}
                  isLoading={productVariantQuery.isFetching}
                  invalid={fieldState.invalid}
                  error={fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  placeholder={
                    selectedWarehouseId
                      ? "Select product variant..."
                      : "Select a warehouse first"
                  }
                  emptyMessage="All product variants are already in this warehouse inventory, or no variants match."
                />
              )}
            />
            {state.mode === DialogMode.EDIT && <Controller name="reason" control={form.control} render={({ field, fieldState }) => <Field>
              <FieldLabel htmlFor="stock-adjustment-reason">Reason for stock adjustment</FieldLabel>
              <Input {...field} value={field.value ?? ""} id="stock-adjustment-reason" placeholder="For example: received delivery or corrected count" />
              <FieldError errors={[fieldState.error]} />
            </Field>} />}
            <Controller
              name="quantity"
              control={form.control}
              disabled={
                (state.mode === DialogMode.EDIT &&
                  inventoryDetailQuery.isFetching) ||
                inventoryDetailQuery.isFetching
              }
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="quantity">
                    Quantity<span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id="quantity"
                    min={form.getValues("reserved") ?? 0}
                    step={1}
                    type="number"
                    aria-invalid={fieldState.invalid}
                    placeholder="Enter quantity"
                    autoComplete="off"
                    onChange={(event) => {
                      field.onChange(event.target.valueAsNumber);
                    }}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            {state.mode === DialogMode.EDIT && (
              <Controller
                name="reserved"
                control={form.control}
                disabled={
                  (state.mode === DialogMode.EDIT &&
                    inventoryDetailQuery.isFetching) ||
                  inventoryDetailQuery.isFetching
                }
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="reserved">
                      Reserved<span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      {...field}
                      id="reserved"
                      readOnly
                      title="Reservations are managed by orders"
                      type="number"
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter reserved quantity"
                      autoComplete="off"
                      onChange={(event) => {
                        field.onChange(event.target.valueAsNumber);
                      }}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            )}
          </FieldGroup>
        </form>
      </>
    );

  return (
    <>
      <DialogContent
        className={
          state.mode === DialogMode.DELETE ? "sm:max-w-md" : "sm:max-w-2xl"
        }
      >
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>

        {!state.isOpen ? (
          <Loader2
            className="mx-auto size-6 animate-spin"
            aria-label="Loading"
          />
        ) : state.mode !== DialogMode.DELETE && state.isOpen ? (
          formContent
        ) : (
          state.mode === DialogMode.DELETE &&
          state.isOpen && (
            <>
              <form
                id="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  onDelete();

                }}
              >
                {form.formState.errors.root && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
              </form>
            </>
          )
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline">
                Cancel
              </Button>
            }
          />
          <Button
            variant={
              state.mode === DialogMode.DELETE ? "destructive" : "default"
            }
            disabled={!state.isOpen || form.formState.isSubmitting || deleting || (state.mode === DialogMode.EDIT && (inventoryDetailQuery.isFetching || inventoryDetailQuery.isError || !inventoryDetailQuery.data))}
            type="submit"
            form="form"
          >
            {form.formState.isSubmitting || deleting ? "Saving..." : state.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </>
  );
}
