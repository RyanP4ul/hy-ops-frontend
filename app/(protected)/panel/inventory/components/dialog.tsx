"use client";

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
import { Controller, useForm } from "react-hook-form";
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
import { useComboBoxPagination } from "@/components/base-pagination";
import { useEffect } from "react";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";

export default function DialogPage() {
  const { state, dispatch } = useModal();
  const {
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

  useEffect(() => {
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

      if (productVariantQuery.data) {
        productVariantCB.setInputValue(
          inventoryDetailQuery.data?.product_variant_sku ?? "",
        );
      }
    } else {
      form.reset({
        warehouse_id: 0,
        product_variant_id: 0,
        quantity: 0,
      });

      warehouseCB.setInputValue("");
      productVariantCB.setInputValue("");
    }
  }, [state, inventoryDetailQuery.isFetched]);

  async function onSubmit(data: any) {
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

    dispatch({
      type: "CLOSE",
    });
  }

  async function onDelete() {
    ToastSubmit({ inventory_id: inventoryDetail.id });
    await deleteInventory();
    inventoryQuery.refetch();
  }

  function Form() {
    return (
      <>
        <form
          id="form"
          onSubmit={form.handleSubmit(onSubmit, (error) =>
            ToastValidationError(error),
          )}
        >
          <FieldGroup className="grid grid-cols-1 items-center gap-4">
            <Controller
              name="warehouse_id"
              control={form.control}
              render={({ field, fieldState }) => (
                <Combobox
                  open={warehouseCB.open}
                  onOpenChange={(open) => warehouseCB.setOpen(open)}
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(value) => {
                    const selectedWarehouse = warehouseQuery.data?.rows?.find(
                      (warehouse) => warehouse.id === Number(value),
                    );

                    warehouseCB.setInputValue(selectedWarehouse?.name ?? "");

                    field.onChange(value ? Number(value) : null);
                  }}
                >
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="warehouse-name">
                      Warehouse<span className="text-destructive">*</span>
                    </FieldLabel>

                    <ComboboxInput
                      placeholder="Select warehouse name..."
                      value={warehouseCB.inputValue}
                      disabled={warehouseQuery.isFetching}
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
                                <ItemDescription>Unknown</ItemDescription>
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
            <Controller
              name="product_variant_id"
              control={form.control}
              render={({ field, fieldState }) => (
                <Combobox
                  open={productVariantCB.open}
                  onOpenChange={(open) => productVariantCB.setOpen(open)}
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(value) => {
                    const selectedProductVariant =
                      productVariantQuery.data?.rows?.find(
                        (productVariant) => productVariant.id === Number(value),
                      );

                    productVariantCB.setInputValue(
                      selectedProductVariant?.sku ?? "",
                    );

                    field.onChange(value ? Number(value) : null);
                  }}
                >
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="Product-Variant">
                      Product Variant<span className="text-destructive">*</span>
                    </FieldLabel>

                    <ComboboxInput
                      placeholder="Select product variant..."
                      value={productVariantCB.inputValue}
                      disabled={productVariantQuery.isFetching}
                      aria-invalid={fieldState.invalid}
                      readOnly
                    />
                    <ComboboxContent>
                      <ComboboxList>
                        {productVariantQuery.data?.rows?.map(
                          (productVariant) => (
                            <ComboboxItem
                              key={productVariant.id}
                              value={String(productVariant.id)}
                            >
                              <Item size="xs" className="p-0">
                                <ItemContent>
                                  <ItemTitle className="whitespace-nowrap">
                                    ({productVariant.id}) {productVariant.sku}
                                  </ItemTitle>
                                  <ItemDescription>
                                    ₱{productVariant.price}
                                  </ItemDescription>
                                </ItemContent>
                              </Item>
                            </ComboboxItem>
                          ),
                        )}

                        {productVariantQuery.isFetching && (
                          <div className="px-2 py-1 text-xs text-muted-foreground">
                            Loading...
                          </div>
                        )}

                        {!productVariantQuery.isFetching &&
                          productVariantQuery.data?.rows?.length === 0 && (
                            <ComboboxEmpty>No found.</ComboboxEmpty>
                          )}
                      </ComboboxList>

                      <div className="flex items-center justify-between border-t p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            productVariantCB.page <= 0 ||
                            productVariantQuery.isFetching
                          }
                          onClick={() => productVariantCB.setPage((p) => p - 1)}
                        >
                          Previous
                        </Button>

                        <span className="text-muted-foreground text-xs">
                          {productVariantCB.page + 1} /{" "}
                          {productVariantCB.totalPages}
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            productVariantCB.page + 1 >=
                              productVariantCB.totalPages ||
                            productVariantQuery.isFetching
                          }
                          onClick={() => {
                            productVariantCB.setPage((p) => p + 1);
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
  }

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
          <Form />
        ) : (
          state.mode === DialogMode.DELETE &&
          state.isOpen && (
            <>
              <form
                id="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  onDelete();
                  dispatch({
                    type: "CLOSE",
                  });
                }}
              ></form>
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
            disabled={!state.isOpen}
            type="submit"
            form="form"
          >
            {state.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </>
  );
}
