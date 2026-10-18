"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeliverySchedule } from "../provider";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Controller, useFieldArray, useForm } from "react-hook-form";
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
import { OrderFormData, orderSchema } from "@/schema/delivery-schedule";
import { toast } from "sonner";

export default function SubDialog() {
  const { form, sub, setSub, orderCB, orderQuery } =
    useDeliverySchedule();

  const item_form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      order_id: -1,
    },
  });

  async function onSubmit(data: OrderFormData) {
    const currentOrderIds = form.getValues("order_ids") || {};

    // Check if the order_id is already in the array
    if (currentOrderIds.includes(data.order_id)) {
      toast("Order already added.");
      setSub({ is_open: false, mode: DialogMode.DEFAULT });
      return;
    }

    currentOrderIds.push(data.order_id);
    form.setValue("order_ids", currentOrderIds);

    item_form.reset();
    setSub({ is_open: false, mode: DialogMode.DEFAULT });
  }

  const getModalSize = () => {
    switch (sub.mode) {
      case DialogMode.DELETE:
        return "sm:max-w-md";
      case DialogMode.CUSTOM:
        return "sm:max-w-3xl";
      default:
        return "sm:max-w-xl";
    }
  };

  useEffect(() => {
    if (sub.is_open && sub.mode === DialogMode.INSERT) {
      item_form.reset();

      orderCB.setInputValue("");
    }
  }, [sub.mode]);

  function Form() {
    return (
      <form
        id="sub-form"
        onSubmit={item_form.handleSubmit(onSubmit, (error) =>
          ToastValidationError(error),
        )}
      >
        <FieldGroup className="grid gap-5">
          <Controller
            name="order_id"
            control={item_form.control}
            render={({ field, fieldState }) => (
              <Combobox
                open={orderCB.open}
                onOpenChange={(open) => orderCB.setOpen(open)}
                value={field.value ? String(field.value) : ""}
                onValueChange={(value) => {
                  const selectedOrder = orderQuery.data?.rows?.find(
                    (order) => order.id === Number(value),
                  );

                  orderCB.setInputValue(selectedOrder?.order_number ?? "");

                  field.onChange(value ? Number(value) : null);
                }}
              >
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="inventory_id">
                    Order<span className="text-destructive">*</span>
                  </FieldLabel>

                  <ComboboxInput
                    placeholder="Select order number..."
                    value={orderCB.inputValue}
                    disabled={orderQuery.isFetching}
                    aria-invalid={fieldState.invalid}
                    readOnly
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      {orderQuery.data?.rows?.map((order) => (
                        <ComboboxItem key={order.id} value={String(order.id)}>
                          <Item size="xs" className="p-0">
                            <ItemContent>
                              <ItemTitle className="whitespace-nowrap">
                                ({order.id}) {order.order_number}
                              </ItemTitle>
                              <ItemDescription>{order.name}</ItemDescription>
                            </ItemContent>
                          </Item>
                        </ComboboxItem>
                      ))}

                      {orderQuery.isFetching && (
                        <div className="px-2 py-1 text-xs text-muted-foreground">
                          Loading...
                        </div>
                      )}

                      {!orderQuery.isFetching &&
                        orderQuery.data?.rows?.length === 0 && (
                          <ComboboxEmpty>No found.</ComboboxEmpty>
                        )}
                    </ComboboxList>

                    <div className="flex items-center justify-between border-t p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={orderCB.page <= 0 || orderQuery.isFetching}
                        onClick={() => orderCB.setPage((p) => p - 1)}
                      >
                        Previous
                      </Button>

                      <span className="text-muted-foreground text-xs">
                        {orderCB.page + 1} / {orderCB.totalPages}
                      </span>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={
                          orderCB.page + 1 >= orderCB.totalPages ||
                          orderQuery.isFetching
                        }
                        onClick={() => {
                          orderCB.setPage((p) => p + 1);
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
        </FieldGroup>
      </form>
    );
  }

  async function onDelete() {
    if (sub.id === undefined) {
      console.error("Item ID is undefined. Cannot delete item.");
      return;
    }

    setSub({ is_open: false, mode: DialogMode.DEFAULT });
  }

  function DeleteConfirmation() {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete this variant? This action cannot be
          undone.
        </p>
      </div>
    );
  }

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
                ? "Add Order"
                : sub.mode === DialogMode.EDIT
                  ? "Edit Order"
                  : "Delete Order"}
            </DialogTitle>
            <DialogDescription>
              {sub.mode === DialogMode.INSERT
                ? "Add a new order"
                : sub.mode === DialogMode.EDIT
                  ? "Edit this order"
                  : "Are you sure you want to delete this order?"}
            </DialogDescription>
          </DialogHeader>

          {sub.mode === DialogMode.INSERT || sub.mode === DialogMode.EDIT ? (
            <Form />
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
              type="submit"
              form="sub-form"
            >
              {sub.mode === DialogMode.INSERT
                ? "Add Order"
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
