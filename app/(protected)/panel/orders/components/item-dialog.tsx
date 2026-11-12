"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { request } from "@/components/http";
import { useOrders } from "../provider";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { ProductVariantType, productVariantSchema } from "@/schema/product";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToastValidationError } from "@/components/util";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { useEffect, useState } from "react";
import {
  OrderDetail,
  OrderItem,
  OrderItemDetail,
  orderItemSchema,
} from "@/schema/order";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";

export default function OrderItemDialog() {
  const {
    form,
    selected,
    sub,
    setSub,
    orderDetailQuery,
    inventoryQuery,
    inventoryCB,
    orderItemDetailQuery,
    inventoryItem,
    setInventoryItem,
    getAvailableStock,
  } = useOrders();

  const item_form = useForm<OrderItem>({
    resolver: zodResolver(orderItemSchema),
    defaultValues: {
      order_id: orderDetailQuery.data?.id || 0,
      inventory_id: 0,
      quantity: 1,
    },
  });

  const fieldArray = useFieldArray({
    control: form.control,
    name: "items",
  });

  const inventoryId = useWatch({ control: item_form.control, name: "inventory_id" });
  const quantityInput = useWatch({ control: item_form.control, name: "quantity" });
  const selectedStock = inventoryQuery.data?.rows.find(item => item.id === inventoryId);
  const available = selectedStock ? getAvailableStock(inventoryId, selectedStock.quantity, sub.mode === DialogMode.EDIT) : undefined;

  async function onSubmit(data: OrderItem) {
    item_form.clearErrors("root");
    try {
      const response = await request("GET", `/api/inventory/details?ids=${data.inventory_id}`);
      if (!response.ok) throw new Error("Unable to verify stock. Try again.");
      const [stock] = await response.json() as (OrderItemDetail & { quantity: number; price: string | number })[];
      if (!stock) throw new Error("This item is no longer available.");
      const current = form.getValues("items");
      const existing = current.find((item) => item.inventory_id === data.inventory_id);
      const quantity = sub.mode === DialogMode.EDIT ? data.quantity : (existing?.quantity ?? 0) + data.quantity;
      const available = getAvailableStock(data.inventory_id, stock.quantity, true);
      if (quantity > available) { item_form.setError("quantity", { message: `Only ${available} units are currently available across this submission.` }); return; }
      const item = { ...stock, description: stock.description ?? "", price: Number(stock.price), quantity };
      form.setValue("items", existing ? current.map((row) => row.inventory_id === data.inventory_id ? item : row) : [...current, item], { shouldValidate: true });
      item_form.reset();
      setSub({ is_open: false, mode: DialogMode.DEFAULT });
    } catch (error) { item_form.setError("root", { message: error instanceof Error ? error.message : "Unable to add item." }); }
  }

  const getModalSize = () => {
    switch (sub.mode) {
      case DialogMode.ARCHIVE:
      case DialogMode.DELETE:
        return "sm:max-w-md";
      case DialogMode.CUSTOM:
        return "sm:max-w-3xl";
      default:
        return "sm:max-w-xl";
    }
  };

  const itemForm = (
      <form
        id="sub-form"
        onSubmit={item_form.handleSubmit(onSubmit, (error) =>
          ToastValidationError(error),
        )}
      >
        {item_form.formState.errors.root && <p role="alert" className="mb-3 text-sm text-destructive">{item_form.formState.errors.root.message}</p>}
        <FieldGroup className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-1">
            <div className="grid grid-cols-2 gap-2">
              <Controller
                name="inventory_id"
                control={item_form.control}
                render={({ field, fieldState }) => (
                  <Combobox
                    disabled={sub.mode === DialogMode.EDIT}
                    open={inventoryCB.open}
                    onOpenChange={(open) => inventoryCB.setOpen(open)}
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => {
                      const selectedInventory = inventoryQuery.data?.rows?.find(
                        (inventory) => inventory.id === Number(value),
                      );

                      inventoryCB.setInputValue(selectedInventory?.sku ?? "");

                      field.onChange(value ? Number(value) : null);
                    }}
                  >
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="inventory_id">
                        Item<span className="text-destructive">*</span>
                      </FieldLabel>

                      <ComboboxInput
                        id="inventory_id"
                        placeholder="Select inventory name..."
                        value={inventoryCB.inputValue}
                        disabled={inventoryQuery.isFetching}
                        aria-invalid={fieldState.invalid}
                        readOnly
                      />
                      <ComboboxContent>
                        <ComboboxList>
                          {inventoryQuery.data?.rows?.map((item) => (
                            <ComboboxItem key={item.id} value={String(item.id)} disabled={getAvailableStock(item.id, item.quantity) === 0}>
                              <Item size="xs" className="p-0">
                                <ItemContent>
                                  <ItemTitle className="whitespace-nowrap">
                                    ({item.id}) {item.sku} -{" "}
                                    {getAvailableStock(item.id, item.quantity)}
                                  </ItemTitle>
                                  <ItemDescription>{item.name}</ItemDescription>
                                </ItemContent>
                              </Item>
                            </ComboboxItem>
                          ))}

                          {inventoryQuery.isFetching && (
                            <div className="px-2 py-1 text-xs text-muted-foreground">
                              Loading...
                            </div>
                          )}

                          {!inventoryQuery.isFetching &&
                            inventoryQuery.data?.rows?.length === 0 && (
                              <ComboboxEmpty>No found.</ComboboxEmpty>
                            )}
                        </ComboboxList>

                        <div className="flex items-center justify-between border-t p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={
                              inventoryCB.page <= 0 || inventoryQuery.isFetching
                            }
                            onClick={() => inventoryCB.setPage((p) => p - 1)}
                          >
                            Previous
                          </Button>

                          <span className="text-muted-foreground text-xs">
                            {inventoryCB.page + 1} / {inventoryCB.totalPages}
                          </span>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={
                              inventoryCB.page + 1 >= inventoryCB.totalPages ||
                              inventoryQuery.isFetching
                            }
                            onClick={() => {
                              inventoryCB.setPage((p) => p + 1);
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
                control={item_form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="quantity">
                      Quantity<span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      {...field}
                      id="quantity"
                      min={1}
                      max={available}
                      step={1}
                      type="number"
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter quantity"
                      autoComplete="off"
                      onChange={(event) => {
                        field.onChange(event.target.valueAsNumber);
                      }}
                    />
                    {available !== undefined && <FieldDescription>
                      {Math.max(0, available - (Number.isFinite(quantityInput) ? quantityInput : 0))} units remaining after this selection.
                    </FieldDescription>}
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          </div>
        </FieldGroup>
      </form>
    );

  async function onDelete() {
    if (sub.id === undefined) {
      console.error("Item ID is undefined. Cannot delete item.");
      return;
    }

    fieldArray.remove(Number(sub.id));
    setSub({ is_open: false, mode: DialogMode.DEFAULT });
  }


  useEffect(() => {
    if (!sub.is_open) return;
    if (sub.mode === DialogMode.EDIT) {
      const item = form
        .getValues("items")
        .find((item) => item.inventory_id === sub.id);

      if (!item) return;

      item_form.reset(item);

      if (inventoryCB) {
        inventoryCB.setInputValue(item.product_variant_sku);
      }
    } else {
      item_form.reset({
        order_id: -1,
        inventory_id: -1,
        quantity: 1,
      });

      inventoryCB.setInputValue("");
    }
  }, [sub, form, item_form, inventoryCB.setInputValue]);


  return (
    <>
      <Dialog
        open={sub.is_open}
        onOpenChange={(open) => setSub({ ...sub, is_open: open })}
      >
        <DialogContent className={getModalSize()}>
          <DialogHeader>
            <DialogTitle>
              {sub.mode === DialogMode.INSERT
                ? "Add Item"
                : sub.mode === DialogMode.EDIT
                  ? "Edit Item"
                  : "Delete Item"}
            </DialogTitle>
            <DialogDescription>
              {sub.mode === DialogMode.INSERT
                ? "Add a new item"
                : sub.mode === DialogMode.EDIT
                  ? "Edit this item"
                  : "Are you sure you want to delete this item?"}
            </DialogDescription>
          </DialogHeader>

          {sub.mode === DialogMode.INSERT || sub.mode === DialogMode.EDIT ? (
            itemForm
          ) : (
            <DeleteConfirmation />
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setSub({ is_open: false, mode: DialogMode.DEFAULT })
              }
            >
              Cancel
            </Button>

            <Button
              variant={
                sub.mode === DialogMode.DELETE ? "destructive" : "default"
              }
              onClick={() => sub.mode === DialogMode.DELETE && onDelete()}
              disabled={item_form.formState.isSubmitting}
              type={sub.mode === DialogMode.DELETE ? "button" : "submit"}
              form="sub-form"
            >
              {sub.mode === DialogMode.INSERT
                ? "Add Item"
                : sub.mode === DialogMode.EDIT
                  ? "Save Changes"
                  : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

  function DeleteConfirmation() {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Remove this item from the draft order? You can add it again before checkout.
        </p>
      </div>
    );
  }
