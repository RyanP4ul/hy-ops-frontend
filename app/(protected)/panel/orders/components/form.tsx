"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useOrders } from "../provider";
import { OrderForm, orderSchema } from "@/schema/order";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Edit, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { ToastSubmit, ToastValidationError } from "@/components/util";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldTitle,
} from "@/components/ui/field";
import { request, requestWithErrorHandling } from "@/components/http";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { REQUESTS } from "@/constant/request";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/utils/format";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

export default function Form() {
  const {
    form,
    step,
    setStep,
    ordersQuery,
    orderDetailQuery,
    selected,
    customerCB,
    customerQuery,
    sub,
    setSub,
    inventoryItem,
    setInventoryItem,
  } = useOrders();
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const deliveryType = useWatch({
    name: "delivery_type",
    control: form.control,
  });

  const [address, setAddress] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");

  const items = useWatch({
    control: form.control,
    name: "items",
  });

  const isCustomShipping = useWatch({
    control: form.control,
    name: "is_custom_shipping",
  });

  useEffect(() => {
    if (
      state.mode === DialogMode.EDIT &&
      orderDetailQuery.data &&
      orderDetailQuery.isFetched
    ) {
      form.reset({
        customer_id: orderDetailQuery.data?.customer_id ?? 0,
        delivery_type: orderDetailQuery.data?.delivery_type ?? "INTERNAL",
        notes: orderDetailQuery.data?.notes ?? "",
        items: orderDetailQuery.data?.items ?? [],
      });

      if (orderDetailQuery.data) {
        customerCB.setInputValue(orderDetailQuery.data?.customer_name ?? "");
      }
    } else {
      form.reset({
        customer_id: -1,
        delivery_type: "INTERNAL",
        notes: "",
        payment_arrangement: "NET_30",
        payment_method: "BANK_TRANSFER",
        is_custom_shipping: false,
        items: [],
        amount_paid: 0,
      });

      customerCB.setInputValue("");

      setInventoryItem([]);
    }
  }, [state, orderDetailQuery.isFetched]);

  const onSuccess = () => {
    ordersQuery.refetch();

    if (selected.id > 0) {
      orderDetailQuery.refetch();
    }

    dispatch({
      type: "CLOSE",
    });
  };

  async function onSubmit(data: OrderForm) {
    ToastSubmit(data);

    if (state.mode === DialogMode.EDIT && selected.id > 0) {
      const response = await request("PUT", `/api/orders/${selected.id}`, data);

      requestWithErrorHandling(response, form, (result) => {
        onSuccess();
        send({
          type: REQUESTS.ORDER_UPDATED,
          payload: [JSON.stringify(result)],
        });
      });
    } else {
      const response = await request("POST", "/api/orders", data);

      requestWithErrorHandling(response, form, (result) => {
        onSuccess();
        send({
          type: REQUESTS.ORDER_ADDED,
          payload: [
            JSON.stringify({
              id: result?.id ?? 0,
              customer_id: data.customer_id,
              delivery_type: data.delivery_type,
              notes: data.notes,
            }),
          ],
        });
      });
    }
  }

  function ReviewItem({ label, value }: { label: string; value: string }) {
    return (
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">
          {value || "Not specified"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <form
          id="form"
          onSubmit={form.handleSubmit(onSubmit, (error) =>
            ToastValidationError(error),
          )}
          className="space-y-4"
        >
          {step === 0 && (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Controller
                    name="customer_id"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Combobox
                        open={customerCB.open}
                        onOpenChange={(open) => customerCB.setOpen(open)}
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(value) => {
                          const selectedCustomer =
                            customerQuery.data?.rows?.find(
                              (customer) => customer.id === Number(value),
                            );

                          customerCB.setInputValue(
                            selectedCustomer?.name ?? "",
                          );

                          setAddress(selectedCustomer?.address ?? "");
                          setCompanyName(selectedCustomer?.company_name ?? "");

                          console.log(
                            `Selected Customer: ${JSON.stringify(selectedCustomer)}`,
                          );

                          console.log(`Value: ${value}, Type: ${typeof value}`);

                          field.onChange(value ? Number(value) : null);
                        }}
                      >
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="customer-name">
                            Customer<span className="text-destructive">*</span>
                          </FieldLabel>

                          <ComboboxInput
                            placeholder="Select customer name..."
                            value={customerCB.inputValue}
                            disabled={ordersQuery.isFetching}
                            aria-invalid={fieldState.invalid}
                            readOnly
                          />
                          <ComboboxContent>
                            <ComboboxList>
                              {customerQuery.data?.rows?.map(
                                (customer, index) => (
                                  <ComboboxItem
                                    key={index}
                                    value={String(customer.id)}
                                  >
                                    <Item size="xs" className="p-0">
                                      <ItemContent>
                                        <ItemTitle className="whitespace-nowrap">
                                          ({customer.id}) {customer.name}
                                        </ItemTitle>
                                        <ItemDescription>
                                          Unknown
                                        </ItemDescription>
                                      </ItemContent>
                                    </Item>
                                  </ComboboxItem>
                                ),
                              )}

                              {ordersQuery.isFetching && (
                                <div className="px-2 py-1 text-xs text-muted-foreground">
                                  Loading...
                                </div>
                              )}

                              {!ordersQuery.isFetching &&
                                ordersQuery.data?.rows?.length === 0 && (
                                  <ComboboxEmpty>No found.</ComboboxEmpty>
                                )}
                            </ComboboxList>

                            <div className="flex items-center justify-between border-t p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  customerCB.page <= 0 || ordersQuery.isFetching
                                }
                                onClick={() => customerCB.setPage((p) => p - 1)}
                              >
                                Previous
                              </Button>

                              <span className="text-muted-foreground text-xs">
                                {customerCB.page + 1} / {customerCB.totalPages}
                              </span>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  customerCB.page + 1 >=
                                    customerCB.totalPages ||
                                  ordersQuery.isFetching
                                }
                                onClick={() => {
                                  customerCB.setPage((p) => p + 1);
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
                    name="delivery_type"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor="delivery_type">
                          Delivery Type{" "}
                          <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="LALAMOVE">Lalamove</SelectItem>
                              <SelectItem value="PICKUP">
                                Customer pickup
                              </SelectItem>
                              <SelectItem value="INTERNAL">
                                Company delivery
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  />
                </div>

                {address && companyName && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="customer_address">
                        Address (Read Only)
                      </FieldLabel>
                      <Input
                        type="text"
                        value={
                          address ||
                          "Please select a customer to view their address."
                        }
                        autoComplete="off"
                        readOnly
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="customer_company_name">
                        Company Name (Read Only)
                      </FieldLabel>
                      <Input
                        type="text"
                        value={
                          companyName ||
                          "Please select a customer to view their company name."
                        }
                        autoComplete="off"
                        readOnly
                      />
                    </Field>
                  </div>
                )}

                <Controller
                  name="is_custom_shipping"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <RadioGroup
                      value={
                        field.value
                          ? "different-address"
                          : "same-as-shipping-address"
                      }
                      onValueChange={(value) => {
                        field.onChange(value === "different-address");
                      }}
                      id="is_custom_shipping"
                      aria-invalid={fieldState.invalid}
                      className="grid grid-cols-2 gap-2"
                    >
                      <FieldLegend variant="label" className="col-span-2">
                        Shipping Address
                      </FieldLegend>

                      <FieldLabel htmlFor="same-as-shipping-address">
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldTitle>Same as Shipping Address</FieldTitle>
                          </FieldContent>
                          <RadioGroupItem
                            value="same-as-shipping-address"
                            id="same-as-shipping-address"
                          />
                        </Field>
                      </FieldLabel>

                      <FieldLabel htmlFor="different-address">
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldTitle>Use Different Address</FieldTitle>
                          </FieldContent>
                          <RadioGroupItem
                            value="different-address"
                            id="different-address"
                          />
                        </Field>
                      </FieldLabel>
                    </RadioGroup>
                  )}
                />

                {isCustomShipping && (
                  <>
                    <Controller
                      name="shipping_recipient"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="shipping_recipient">
                            Shipping Recipient
                            <span className="text-destructive">*</span>
                          </FieldLabel>
                          <Input
                            {...field}
                            id="shipping_recipient"
                            type="text"
                            aria-invalid={fieldState.invalid}
                            placeholder="Enter shipping recipient"
                            autoComplete="off"
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Controller
                        name="shipping_phone"
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="shipping_phone">
                              Shipping Phone
                              <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                              {...field}
                              id="shipping_phone"
                              type="text"
                              aria-invalid={fieldState.invalid}
                              placeholder="Enter shipping phone"
                              autoComplete="off"
                            />
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </Field>
                        )}
                      />
                      <Controller
                        name="shipping_address"
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="shipping_address">
                              Shipping Address
                              <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                              {...field}
                              id="shipping_address"
                              type="text"
                              aria-invalid={fieldState.invalid}
                              placeholder="Enter shipping address"
                              autoComplete="off"
                            />
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </Field>
                        )}
                      />
                    </div>
                  </>
                )}

                <Controller
                  name="notes"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
                      <Textarea
                        {...field}
                        id="notes"
                        placeholder="Add order notes or delivery instructions..."
                        rows={4}
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <section className="space-y-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Items <span className="text-destructive">*</span>
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add items to the order.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      setSub({
                        is_open: true,
                        mode: DialogMode.INSERT,
                      });
                    }}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    Add Item
                  </Button>
                </div>
                {form.formState.errors.items?.root?.message && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.items.root.message}
                  </p>
                )}
                {/* {form.formState.errors.items?.message && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.items.message}
                  </p>
                )} */}
                <div className="overflow-hidden rounded-lg border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="min-w-32.5">SKU</TableHead>
                          <TableHead className="min-w-45">
                            Description
                          </TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items?.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {item.product_variant_sku || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {item.description || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                              {formatCurrency(item.price)}
                            </TableCell>
                            <TableCell>{item.quantity || "—"}</TableCell>
                            <TableCell>
                              {formatCurrency(item.price * item.quantity)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  // form.setValue("items", [
                                  //   ...form.getValues("items"),
                                  // ]);

                                  console.log(`id: ${item.inventory_id}`);
                                  console.log(
                                    JSON.stringify(form.getValues("items")),
                                  );

                                  setSub({
                                    id: item.inventory_id,
                                    is_open: true,
                                    mode: DialogMode.EDIT,
                                  });
                                }}
                              >
                                <Edit className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSub({
                                    id: index,
                                    is_open: true,
                                    mode: DialogMode.DELETE,
                                  });
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {items?.length < 1 && (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="h-24 text-center text-sm text-muted-foreground"
                            >
                              No item have been added yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </section>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Total order value
                  </p>
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-2xl font-semibold">
                  {formatCurrency(
                    form
                      .getValues("items")
                      .reduce(
                        (acc, item) => acc + item.price * item.quantity,
                        0,
                      ),
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This is the total value of the order based on the items added.
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Controller
                  name="payment_arrangement"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="payment_arrangement">
                        Payment Arrangement{" "}
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="FULLY_PAID">
                              Fully Paid
                            </SelectItem>
                            <SelectItem value="PARTIALLY_PAID">
                              Partially Paid
                            </SelectItem>
                            <SelectItem value="NET_30">Net 30</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
                <Controller
                  name="payment_method"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="payment_method">
                        Payment Method{" "}
                        <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="BANK_TRANSFER">
                              Bank Transfer
                            </SelectItem>
                            <SelectItem value="CARD">Credit Card</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="amount_paid"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="amount_paid">
                      Amount Paid<span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      {...field}
                      id="amount_paid"
                      type="number"
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter amount paid"
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

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Total order value
                  </p>
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-2xl font-semibold">
                  {formatCurrency(
                    form
                      .getValues("items")
                      .reduce(
                        (acc, item) => acc + item.price * item.quantity,
                        0,
                      ),
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This is the total value of the order based on the items added.
                </p>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-5">
                <div>
                  <h3 className="font-semibold">Review Order</h3>
                  <p className="text-sm text-muted-foreground">
                    Check the information before submitting.
                  </p>
                </div>

                <section className="space-y-3">
                  <h4 className="text-sm font-medium">Order Information</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReviewItem label="Customer" value={"customer"} />
                    <ReviewItem label="Product" value={"product"} />
                    <ReviewItem label="Quantity" value={"1"} />
                  </div>
                </section>

                <Separator />

                <p className="text-xs text-muted-foreground">
                  Final pricing, stock availability, and delivery scheduling
                  must be validated by the backend.
                </p>
              </div>
            </>
          )}
        </form>
      </div>
    </>
  );
}
