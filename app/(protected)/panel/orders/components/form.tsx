"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Controller, useWatch } from "react-hook-form";
import { Edit, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useOrders } from "../provider";
import { OrderForm } from "@/schema/order";
import { orderPaymentMethodLabels, orderPaymentMethodSchema } from "@/schema/order-payment-method";
import {
  orderBatchFormSchema,
  toOrderBatchPayload,
  previewCombinedOrders,
} from "@/schema/order-batch";
import { ToastValidationError } from "@/components/util";
import {
  Field,
  FieldError,
  FieldLabel,
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { PaymentTypeCombobox } from "@/components/payment-type-combobox";
import { formatCurrency } from "@/utils/date-util";
import { cn } from "@/lib/utils";
import { SavedAddressForm } from "./saved-address-form";

const DELIVERY_METHODS = [
  { value: "INTERNAL", label: "Company delivery" },
  { value: "LALAMOVE", label: "Lalamove" },
] as const;

const PAYMENT_ARRANGEMENTS: Record<string, string> = {
  FULLY_PAID: "Fully paid",
  PARTIALLY_PAID: "Partially paid",
  NET_30: "Net 30",
};

function formatCustomerAddress(address: {
  address_line: string;
  barangay: string;
  city_municipality: string;
  province: string;
  postal_code: string | null;
}): string {
  return [
    address.address_line,
    address.barangay,
    address.city_municipality,
    address.province,
    address.postal_code,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export default function Form() {
  const router = useRouter();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const {
    isStaff,
    form,
    step,
    setStep,
    setPage,
    ordersQuery,
    orderDetailQuery,
    selected,
    warehouseCB,
    customerCB,
    warehouseQuery,
    customerQuery,
    customerOrderEligibility,
    setSub,
    setInventoryItem,
    inventoryCB,
    orderCount,
    activeDraftIndex,
    collectDrafts,
    switchDraft,
    paymentMode,
    combinedPayment,
  } = useOrders();
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();

  const paymentMethod = useWatch({
    name: "payment_method",
    control: form.control,
  });
  const paymentArrangement = useWatch({
    name: "payment_arrangement",
    control: form.control,
  });
  const amountPaidWatch = useWatch({
    name: "amount_paid",
    control: form.control,
  });
  const deliveryType = useWatch({
    name: "delivery_type",
    control: form.control,
  });
  const items = useWatch({
    control: form.control,
    name: "items",
  });
  const selectedCustomerId = useWatch({
    control: form.control,
    name: "customer_id",
  });
  const selectedCustomerAddressId = useWatch({
    control: form.control,
    name: "customer_address_id",
  });

  const selectedCustomer = customerQuery.data?.rows.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const selectedCustomerAddress = selectedCustomer?.addresses.find(
    (customerAddress) => customerAddress.id === selectedCustomerAddressId,
  );
  const savedShippingAddress = selectedCustomerAddress
    ? formatCustomerAddress(selectedCustomerAddress)
    : "";

  const onSuccess = () => {
    setPage((current) => ({ ...current, pageIndex: 0 }));
    ordersQuery.refetch();

    if (selected.id > 0) {
      orderDetailQuery.refetch();
    }

    dispatch({
      type: "CLOSE",
    });
  };

  async function onSubmit(data: OrderForm) {
    const payload = {
      ...data,
      payment_type:
        data.payment_method === "CASH" ? undefined : data.payment_type?.trim(),
    };

    if (state.mode === DialogMode.EDIT && selected.id > 0) {
      const response = await request(
        "PUT",
        `/api/orders/${selected.id}`,
        payload,
      );

      await requestWithErrorHandling(response, form, (result) => {
        onSuccess();
        send({
          type: REQUESTS.ORDER_UPDATED,
          payload: [JSON.stringify(result)],
        });
      });
    } else {
      const drafts = collectDrafts();
      const batch = orderBatchFormSchema.safeParse({
        customer_id: data.customer_id,
        payment_mode: paymentMode,
        combined_payment: combinedPayment,
        orders: drafts.map((draft) => draft.data),
      });
      if (!batch.success) {
        const issue = batch.error.issues[0];
        if (issue?.path[0] === "combined_payment") {
          setStep(2);
          form.setError("root", {
            message: `Combined payment: ${issue.message}`,
          });
          return;
        }
        const index =
          typeof issue?.path[1] === "number"
            ? issue.path[1]
            : activeDraftIndex;
        if (index !== activeDraftIndex) switchDraft(index);
        setStep(0);
        form.setError("root", {
          message: `Order ${index + 1}: ${issue?.message ?? "Complete the order details."}`,
        });
        return;
      }
      const response =
        drafts.length > 1 || paymentMode === "COMBINED"
          ? await request(
              "POST",
              "/api/orders/batch",
              toOrderBatchPayload(batch.data),
            )
          : await request("POST", "/api/orders", payload);

      await requestWithErrorHandling(response, form, (result) => {
        void customerOrderEligibility.refetch();
        onSuccess();
        const created = Array.isArray(result.orders) ? result.orders : [result];
        for (const order of created) {
          send({ type: REQUESTS.ORDER_ADDED, payload: [JSON.stringify(order)] });
        }
        const lalamoveOrder = created.find(
          (order: { id?: number; delivery_type?: string }) =>
            order.delivery_type === "LALAMOVE" &&
            Number.isSafeInteger(order.id) &&
            Number(order.id) > 0,
        );
        if (lalamoveOrder) {
          router.push(`/panel/lalamove?orderId=${lalamoveOrder.id}`);
        }
      });
    }
  }

  const reviewTotal = items?.some((item) => item.price === undefined)
    ? null
    : (items?.reduce(
        (total, item) => total + (item.price ?? 0) * item.quantity,
        0,
      ) ?? 0);

  const totalUnits = (items ?? []).reduce((sum, item) => sum + item.quantity, 0);

  const reviewValues =
    paymentMode === "COMBINED"
      ? previewCombinedOrders(
          collectDrafts().map((draft) => draft.data),
          combinedPayment,
        )[activeDraftIndex]
      : form.getValues();
  const reviewAmountPaid = reviewValues.amount_paid;
  const reviewWarehouseId = form.getValues("warehouse_id");
  const reviewCustomerId = form.getValues("customer_id");
  const reviewPaymentArrangement = reviewValues.payment_arrangement;
  const reviewPaymentMethod = reviewValues.payment_method;
  const reviewIsCustomShipping = form.getValues("is_custom_shipping");
  const reviewNotes = form.getValues("notes");
  const reviewDeliveryType = form.getValues("delivery_type");

  const deliveryLabel =
    DELIVERY_METHODS.find((m) => m.value === reviewDeliveryType)?.label ||
    reviewDeliveryType;

  const liveBalance =
    reviewTotal === null
      ? null
      : Math.max(
          0,
          Math.round(reviewTotal * 100) -
            Math.round(
              (Number.isFinite(amountPaidWatch) ? amountPaidWatch : 0) * 100,
            ),
        ) / 100;

  return (
    <form
      id="form"
      noValidate
      onSubmit={(event) => {
        if (step !== 3) {
          event.preventDefault();
          return;
        }
        void form.handleSubmit(onSubmit, (error) =>
          ToastValidationError(error),
        )(event);
      }}
      className="min-w-0 space-y-5"
    >
      {/* STEP 0: Customer & Destination */}
      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          {!isStaff && (
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

                    if (field.value !== Number(value)) {
                      form.setValue("items", []);
                      setInventoryItem([]);
                      inventoryCB.setPage(0);
                      inventoryCB.setInputValue("");
                    }
                    field.onChange(value ? Number(value) : null);
                  }}
                >
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="warehouse-name">
                      Warehouse <span className="text-destructive">*</span>
                    </FieldLabel>

                    <ComboboxInput
                      id="warehouse-name"
                      placeholder="Select warehouse"
                      value={warehouseCB.inputValue}
                      disabled={warehouseQuery.isFetching}
                      aria-invalid={fieldState.invalid ? "true" : "false"}
                      readOnly
                    />
                    <ComboboxContent>
                      <ComboboxList>
                        {warehouseQuery.data?.rows?.map((warehouse) => (
                          <ComboboxItem
                            key={warehouse.id}
                            value={String(warehouse.id)}
                          >
                            <Item size="xs" className="p-0">
                              <ItemContent>
                                <ItemTitle className="whitespace-nowrap">
                                  {warehouse.name}
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
                            <ComboboxEmpty>No warehouses found.</ComboboxEmpty>
                          )}
                      </ComboboxList>

                      <div className="flex items-center justify-between border-t p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={
                            warehouseCB.page <= 0 || warehouseQuery.isFetching
                          }
                          onClick={() => warehouseCB.setPage((p) => p - 1)}
                        >
                          Previous
                        </Button>

                        <span className="text-xs text-muted-foreground tabular-nums">
                          {warehouseCB.page + 1} / {warehouseCB.totalPages}
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={
                            warehouseCB.page + 1 >= warehouseCB.totalPages ||
                            warehouseQuery.isFetching
                          }
                          onClick={() => warehouseCB.setPage((p) => p + 1)}
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
          )}

          <Controller
            name="customer_id"
            control={form.control}
            render={({ field, fieldState }) => (
              <Combobox
                disabled={orderCount > 1}
                open={customerCB.open}
                onOpenChange={(open) => customerCB.setOpen(open)}
                value={field.value ? String(field.value) : ""}
                onValueChange={(value) => {
                  if (orderCount > 1) return;
                  const picked = customerQuery.data?.rows?.find(
                    (customer) => customer.id === Number(value),
                  );

                  customerCB.setInputValue(picked?.name ?? "");
                  field.onChange(value ? Number(value) : null);
                  const addresses = picked?.addresses ?? [];
                  form.setValue(
                    "customer_address_id",
                    addresses.length === 1 ? addresses[0]?.id : undefined,
                    { shouldDirty: true },
                  );
                  form.setValue("is_custom_shipping", false, {
                    shouldDirty: true,
                  });

                  form.clearErrors(["customer_id", "customer_address_id"]);
                }}
              >
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="customer-name">
                    Customer <span className="text-destructive">*</span>
                  </FieldLabel>

                  <ComboboxInput
                    placeholder="Select customer"
                    id="customer-name"
                    value={customerCB.inputValue}
                    disabled={customerQuery.isFetching || orderCount > 1}
                    aria-invalid={fieldState.invalid ? "true" : "false"}
                    readOnly
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      {customerQuery.data?.rows?.map((customer) => (
                        <ComboboxItem
                          key={customer.id}
                          value={String(customer.id)}
                        >
                          <Item size="xs" className="p-0">
                            <ItemContent>
                              <ItemTitle className="whitespace-nowrap">
                                {customer.name}
                              </ItemTitle>
                              <ItemDescription>
                                {customer.company_name
                                  ? `${customer.company_name} · `
                                  : ""}
                                {customer.addresses.length}{" "}
                                {customer.addresses.length === 1
                                  ? "address"
                                  : "addresses"}
                              </ItemDescription>
                            </ItemContent>
                          </Item>
                        </ComboboxItem>
                      ))}

                      {customerQuery.isFetching && (
                        <div className="px-2 py-1 text-xs text-muted-foreground">
                          Loading...
                        </div>
                      )}

                      {!customerQuery.isFetching &&
                        customerQuery.data?.rows?.length === 0 && (
                          <ComboboxEmpty>No customers found.</ComboboxEmpty>
                        )}
                    </ComboboxList>

                    <div className="flex items-center justify-between border-t p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={
                          customerCB.page <= 0 || customerQuery.isFetching
                        }
                        onClick={() => customerCB.setPage((p) => p - 1)}
                      >
                        Previous
                      </Button>

                      <span className="text-xs text-muted-foreground tabular-nums">
                        {customerCB.page + 1} / {customerCB.totalPages}
                      </span>

                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={
                          customerCB.page + 1 >= customerCB.totalPages ||
                          customerQuery.isFetching
                        }
                        onClick={() => customerCB.setPage((p) => p + 1)}
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

          {/* Compact customer summary strip (company, phone, active orders in one place) */}
          {selectedCustomer && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/25 px-3.5 py-2.5 text-xs sm:col-span-2">
              {selectedCustomer.company_name && (
                <span className="font-medium text-foreground">
                  {selectedCustomer.company_name}
                </span>
              )}
              {selectedCustomer.phone_number && (
                <span className="text-muted-foreground tabular-nums">
                  {selectedCustomer.phone_number}
                </span>
              )}
              {state.mode === DialogMode.INSERT && (
                <span
                  aria-live="polite"
                  className="text-muted-foreground tabular-nums"
                >
                  {customerOrderEligibility.isFetching
                    ? "Checking active orders..."
                    : customerOrderEligibility.data
                      ? `${customerOrderEligibility.data.activeOrderCount} active ${
                          customerOrderEligibility.data.activeOrderCount === 1
                            ? "order"
                            : "orders"
                        }`
                      : null}
                </span>
              )}
              {orderCount > 1 && (
                <span className="ml-auto text-muted-foreground">
                  Shared across {orderCount} orders
                </span>
              )}
            </div>
          )}

          {/* Saved shipping address */}
          {selectedCustomer && (
            <Controller
              name="customer_address_id"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field
                  className="sm:col-span-2"
                  data-invalid={fieldState.invalid}
                >
                  <FieldLabel htmlFor="customer_address_id">
                    Shipping address <span className="text-destructive">*</span>
                  </FieldLabel>
                  {selectedCustomer.addresses.length > 0 ? (
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => {
                        if (value !== null) {
                          field.onChange(Number(value));
                          form.clearErrors("customer_address_id");
                        }
                      }}
                    >
                      <SelectTrigger
                        id="customer_address_id"
                        className="h-auto min-h-10 w-full [&_[data-slot=select-value]]:whitespace-normal"
                        aria-invalid={fieldState.invalid ? "true" : "false"}
                      >
                        <SelectValue placeholder="Choose a saved address">
                          {selectedCustomerAddress
                            ? formatCustomerAddress(selectedCustomerAddress)
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {selectedCustomer.addresses.map((customerAddress) => (
                            <SelectItem
                              key={customerAddress.id}
                              value={String(customerAddress.id)}
                            >
                              {formatCustomerAddress(customerAddress)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No saved address yet. Add one below before continuing.
                    </p>
                  )}
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}

          {selectedCustomer && (
            <div className="sm:col-span-2">
              <SavedAddressForm
                key={selectedCustomer.id}
                customerId={selectedCustomer.id}
                onSaved={async (address) => {
                  await customerQuery.refetch();
                  if (
                    !mounted.current ||
                    form.getValues("customer_id") !== selectedCustomer.id
                  ) {
                    return;
                  }
                  form.setValue("is_custom_shipping", false);
                  form.setValue("customer_address_id", address.id, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              />
            </div>
          )}

          {/* Delivery method */}
          <Controller
            name="delivery_type"
            control={form.control}
            render={({ field }) => (
              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="text-sm font-medium">Delivery method</legend>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5">
                  {DELIVERY_METHODS.map((option) => {
                    const active = field.value === option.value;
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "cursor-pointer rounded-md px-2.5 py-2 text-center text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-ring",
                          active
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <input
                          type="radio"
                          name="delivery_type"
                          value={option.value}
                          checked={active}
                          onChange={() => field.onChange(option.value)}
                          className="sr-only"
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
                {deliveryType === "LALAMOVE" && (
                  <p className="text-xs text-muted-foreground">
                    Quoted and booked in Lalamove after the order is created.
                  </p>
                )}
              </fieldset>
            )}
          />

          {/* Notes */}
          <Controller
            name="notes"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                className="sm:col-span-2"
                data-invalid={fieldState.invalid}
              >
                <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
                <Textarea
                  {...field}
                  id="notes"
                  placeholder="Delivery instructions or order remarks..."
                  rows={2}
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
      )}

      {/* STEP 1: Order Items */}
      {step === 1 && (
        <section className="space-y-3" aria-label="Order items">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground tabular-nums">
              {items?.length ?? 0}{" "}
              {(items?.length ?? 0) === 1 ? "line item" : "line items"}
              {totalUnits > 0 && ` · ${totalUnits} total units`}
            </p>
            <Button
              id="order-add-item"
              type="button"
              size="sm"
              onClick={() => {
                setSub({
                  is_open: true,
                  mode: DialogMode.INSERT,
                });
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add item
            </Button>
          </div>

          {form.formState.errors.items?.root?.message && (
            <p role="alert" className="text-xs text-destructive">
              {form.formState.errors.items.root.message}
            </p>
          )}
          {form.formState.errors.items?.message && (
            <p role="alert" className="text-xs text-destructive">
              {form.formState.errors.items.message}
            </p>
          )}

          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Item</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[84px] text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item, index) => (
                    <TableRow key={item.inventory_id}>
                      <TableCell className="min-w-[180px]">
                        <p className="font-medium text-foreground">
                          {item.product_variant_name || "—"}
                        </p>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.product_variant_sku || "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {item.price === undefined
                          ? "—"
                          : formatCurrency(item.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                        {item.price === undefined
                          ? "—"
                          : formatCurrency(item.price * item.quantity)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          aria-label={`Edit item ${item.product_variant_sku}`}
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => {
                            setSub({
                              id: item.inventory_id,
                              is_open: true,
                              mode: DialogMode.EDIT,
                            });
                          }}
                        >
                          <Edit className="size-3.5" />
                        </Button>
                        <Button
                          aria-label={`Remove item ${item.product_variant_sku}`}
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setSub({
                              id: index,
                              is_open: true,
                              mode: DialogMode.DELETE,
                            });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {(!items || items.length < 1) && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-32 text-center text-sm text-muted-foreground"
                      >
                        <p className="font-medium text-foreground">
                          No items yet
                        </p>
                        <p className="mt-1 text-xs">
                          Click Add item to pick products from warehouse stock.
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {items && items.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs font-medium text-muted-foreground">
                        Subtotal
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {reviewTotal === null
                          ? "—"
                          : formatCurrency(reviewTotal)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </section>
      )}

      {/* STEP 2: Payment */}
      {step === 2 && paymentMode === "SEPARATE" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              name="payment_arrangement"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="payment_arrangement">
                    Arrangement <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      if (val === "FULLY_PAID" && reviewTotal !== null) {
                        form.setValue("amount_paid", reviewTotal, {
                          shouldDirty: true,
                        });
                        form.clearErrors("amount_paid");
                      } else if (val === "NET_30") {
                        form.setValue("amount_paid", 0, { shouldDirty: true });
                        form.clearErrors("amount_paid");
                      }
                    }}
                  >
                    <SelectTrigger id="payment_arrangement">
                      <SelectValue>
                        {PAYMENT_ARRANGEMENTS[field.value] ?? field.value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="FULLY_PAID">Fully paid</SelectItem>
                        <SelectItem value="PARTIALLY_PAID">
                          Partially paid
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
                    Method <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      if (value !== "CASH" && value !== "BANK_TRANSFER") return;
                      field.onChange(value);
                      form.setValue("payment_type", "", { shouldDirty: true });
                      form.clearErrors("payment_type");
                    }}
                  >
                    <SelectTrigger id="payment_method">
                      <SelectValue>
                        {orderPaymentMethodLabels[field.value]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {orderPaymentMethodSchema.options.map((value) => (
                          <SelectItem key={value} value={value}>
                            {orderPaymentMethodLabels[value]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>

          {paymentMethod === "BANK_TRANSFER" && (
            <Controller
              name="payment_type"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="payment_type">
                    Bank / e-wallet{" "}
                    <span className="text-destructive">*</span>
                  </FieldLabel>
                  <PaymentTypeCombobox
                    key={paymentMethod}
                    method={paymentMethod}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}

          <Controller
            name="amount_paid"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="amount_paid">
                    Amount paid <span className="text-destructive">*</span>
                  </FieldLabel>
                  <div className="flex items-center gap-1.5">
                    {paymentArrangement === "NET_30" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          field.onChange(0);
                          form.clearErrors("amount_paid");
                        }}
                      >
                        ₱0
                      </Button>
                    )}
                    {reviewTotal !== null && reviewTotal > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          field.onChange(reviewTotal);
                          form.clearErrors("amount_paid");
                        }}
                      >
                        Full ({formatCurrency(reviewTotal)})
                      </Button>
                    )}
                  </div>
                </div>
                <Input
                  {...field}
                  id="amount_paid"
                  min={0}
                  step={0.01}
                  max={reviewTotal ?? undefined}
                  type="number"
                  inputMode="decimal"
                  aria-invalid={fieldState.invalid ? "true" : "false"}
                  placeholder="0.00"
                  autoComplete="off"
                  value={Number.isFinite(field.value) ? field.value : ""}
                  onChange={(event) => {
                    field.onChange(event.target.valueAsNumber);
                  }}
                  className="text-base tabular-nums sm:text-sm"
                />
                {liveBalance !== null && !fieldState.invalid && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Remaining balance: {formatCurrency(liveBalance)}
                  </p>
                )}
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
      )}

      {step === 2 && paymentMode === "COMBINED" && (
        <p className="rounded-lg border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          This order uses the combined payment configured above.
        </p>
      )}

      {/* STEP 3: Review */}
      {step === 3 && (
        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Destination</h4>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={form.formState.isSubmitting}
                onClick={() => setStep(0)}
              >
                Edit
              </Button>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <ReviewItem
                label="Customer"
                value={
                  customerCB.inputValue ||
                  (reviewCustomerId > 0 ? `Customer #${reviewCustomerId}` : "")
                }
              />
              <ReviewItem
                label="Warehouse"
                value={
                  warehouseCB.inputValue ||
                  (reviewWarehouseId > 0
                    ? `Warehouse #${reviewWarehouseId}`
                    : "")
                }
              />
              <ReviewItem label="Delivery method" value={deliveryLabel} />
              <ReviewItem
                label="Shipping address"
                value={
                  reviewIsCustomShipping
                    ? (reviewValues.shipping_address ?? "")
                    : savedShippingAddress
                }
              />
              {reviewIsCustomShipping && (
                <>
                  <ReviewItem
                    label="Recipient"
                    value={reviewValues.shipping_recipient ?? ""}
                  />
                  <ReviewItem
                    label="Phone"
                    value={reviewValues.shipping_phone ?? ""}
                  />
                </>
              )}
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                Items ({items?.length ?? 0})
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={form.formState.isSubmitting}
                onClick={() => setStep(1)}
              >
                Edit
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Item</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items?.map((item) => (
                      <TableRow key={item.inventory_id}>
                        <TableCell>
                          <p className="font-medium">
                            {item.product_variant_name || "—"}
                          </p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.product_variant_sku || "—"}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                          {item.price === undefined
                            ? "—"
                            : formatCurrency(item.price)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                          {item.price === undefined
                            ? "—"
                            : formatCurrency(item.price * item.quantity)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!items || items.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          No items added
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Payment</h4>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={form.formState.isSubmitting}
                onClick={() => setStep(2)}
              >
                Edit
              </Button>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <ReviewItem
                label="Arrangement"
                value={
                  PAYMENT_ARRANGEMENTS[reviewPaymentArrangement] ??
                  reviewPaymentArrangement
                }
              />
              <ReviewItem
                label="Method"
                value={orderPaymentMethodLabels[reviewPaymentMethod]}
              />
              {reviewPaymentMethod === "BANK_TRANSFER" && (
                <ReviewItem
                  label="Bank / e-wallet"
                  value={reviewValues.payment_type ?? ""}
                />
              )}
              <ReviewItem
                label={paymentMode === "COMBINED" ? "Allocated" : "Paid"}
                value={formatCurrency(reviewAmountPaid ?? 0)}
              />
              <ReviewItem
                label="Total"
                value={
                  reviewTotal === null ? "—" : formatCurrency(reviewTotal ?? 0)
                }
              />
              <ReviewItem
                label="Balance"
                value={
                  reviewTotal === null
                    ? "—"
                    : formatCurrency(
                        Math.max(
                          0,
                          Math.round((reviewTotal ?? 0) * 100) -
                            Math.round((reviewAmountPaid ?? 0) * 100),
                        ) / 100,
                      )
                }
              />
            </div>
          </section>

          {reviewNotes && (
            <>
              <Separator />
              <ReviewItem label="Notes" value={reviewNotes} />
            </>
          )}
        </div>
      )}
    </form>
  );
}
