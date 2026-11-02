"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useOrders } from "../provider";
import { OrderForm, orderSchema } from "@/schema/order";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
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
import { formatCurrency } from "@/utils/date-util";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

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
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">
          {value || "Not specified"}
        </p>
      </div>
    );
  }

export default function Form() {
  const {
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
    sub,
    setSub,
    inventoryItem,
    setInventoryItem,
    inventoryQuery,
    inventoryCB,
  } = useOrders();
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const deliveryType = useWatch({
    name: "delivery_type",
    control: form.control,
  });

  const items = useWatch({
    control: form.control,
    name: "items",
  });

  const isCustomShipping = useWatch({
    control: form.control,
    name: "is_custom_shipping",
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
    setPage(current => ({ ...current, pageIndex: 0 }));
    ordersQuery.refetch();

    if (selected.id > 0) {
      orderDetailQuery.refetch();
    }

    dispatch({
      type: "CLOSE",
    });
  };

  async function onSubmit(data: OrderForm) {

    if (state.mode === DialogMode.EDIT && selected.id > 0) {
      const response = await request("PUT", `/api/orders/${selected.id}`, data);

      await requestWithErrorHandling(response, form, (result) => {
        onSuccess();
        send({
          type: REQUESTS.ORDER_UPDATED,
          payload: [JSON.stringify(result)],
        });
      });
    } else {
      const response = await request("POST", "/api/orders", data);

      if (response.status === 409) {
        void customerOrderEligibility.refetch();
      }

      await requestWithErrorHandling(response, form, (result) => {
        onSuccess();
        send({
          type: REQUESTS.ORDER_ADDED,
          payload: [JSON.stringify(result)],
        });
      });
    }
  }


  const reviewTotal =
    items?.some((item) => item.price === undefined)
      ? null
      : items?.reduce(
          (total, item) => total + (item.price ?? 0) * item.quantity,
          0,
        );
  const reviewValues = form.getValues();
  const reviewAmountPaid = form.getValues("amount_paid");
  const reviewWarehouseId = form.getValues("warehouse_id");
  const reviewCustomerId = form.getValues("customer_id");
  const reviewDeliveryType = form.getValues("delivery_type");
  const reviewPaymentArrangement = form.getValues("payment_arrangement");
  const reviewPaymentMethod = form.getValues("payment_method");
  const reviewIsCustomShipping = form.getValues("is_custom_shipping");
  const reviewNotes = form.getValues("notes");

  function formatReviewValue(value: string | undefined) {
    return value
      ? value
          .toLowerCase()
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ")
      : "";
  }

  return (
    <>
      <div className="space-y-4">
        <form
          id="form"
          onSubmit={(event) => {
            if (step !== 3) { event.preventDefault(); return; }
            void form.handleSubmit(onSubmit, (error) => ToastValidationError(error))(event);
          }}
          className="space-y-4"
        >
          {step === 0 && (
            <>
              <div className="space-y-4">
                <Controller
                  name="warehouse_id"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Combobox
                      open={warehouseCB.open}
                      onOpenChange={(open) => warehouseCB.setOpen(open)}
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => {
                        const selectedWarehouse =
                          warehouseQuery.data?.rows?.find(
                            (warehouse) => warehouse.id === Number(value),
                          );

                        warehouseCB.setInputValue(
                          selectedWarehouse?.name ?? "",
                        );

                        if (field.value !== Number(value)) { form.setValue("items", []); setInventoryItem([]); inventoryCB.setPage(0); inventoryCB.setInputValue(""); }
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
                          disabled={warehouseQuery.isFetching}
                          aria-invalid={fieldState.invalid}
                          readOnly
                        />
                        <ComboboxContent>
                          <ComboboxList>
                            {warehouseQuery.data?.rows?.map(
                              (productVariant) => (
                                <ComboboxItem
                                  key={productVariant.id}
                                  value={String(productVariant.id)}
                                >
                                  <Item size="xs" className="p-0">
                                    <ItemContent>
                                      <ItemTitle className="whitespace-nowrap">
                                        ({productVariant.id}){" "}
                                        {productVariant.name}
                                      </ItemTitle>
                                      
                                    </ItemContent>
                                  </Item>
                                </ComboboxItem>
                              ),
                            )}

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
                                warehouseCB.page <= 0 ||
                                warehouseQuery.isFetching
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
                                warehouseCB.page + 1 >=
                                  warehouseCB.totalPages ||
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
                  name="customer_id"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Combobox
                      open={customerCB.open}
                      onOpenChange={(open) => customerCB.setOpen(open)}
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => {
                        const selectedCustomer = customerQuery.data?.rows?.find(
                          (customer) => customer.id === Number(value),
                        );

                        customerCB.setInputValue(selectedCustomer?.name ?? "");
                        const addresses = selectedCustomer?.addresses ?? [];
                        form.setValue(
                          "customer_address_id",
                          addresses.length === 1 ? addresses[0]?.id : undefined,
                          { shouldValidate: true },
                        );
                        form.setValue(
                          "is_custom_shipping",
                          addresses.length === 0,
                          { shouldValidate: true },
                        );

                        field.onChange(value ? Number(value) : null);
                      }}
                    >
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="customer-name">
                          Customer<span className="text-destructive">*</span>
                        </FieldLabel>

                        <ComboboxInput
                          placeholder="Select customer name..."
                          id="customer-name"
                          value={customerCB.inputValue}
                          disabled={customerQuery.isFetching}
                          aria-invalid={fieldState.invalid}
                          readOnly
                        />
                        <ComboboxContent>
                          <ComboboxList>
                            {customerQuery.data?.rows?.map(
                              (customer) => (
                                <ComboboxItem
                                  key={customer.id}
                                  value={String(customer.id)}
                                >
                                  <Item size="xs" className="p-0">
                                    <ItemContent>
                                      <ItemTitle className="whitespace-nowrap">
                                        ({customer.id}) {customer.name}
                                      </ItemTitle>
                                      <ItemDescription>
                                        {customer.addresses.length} saved{" "}
                                        {customer.addresses.length === 1
                                          ? "address"
                                          : "addresses"}
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
                                customerCB.page + 1 >= customerCB.totalPages ||
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
                        {state.mode === DialogMode.INSERT && field.value > 0 && (
                          <div aria-live="polite" className="text-sm">
                            {customerOrderEligibility.isFetching && (
                              <p className="text-muted-foreground">
                                Checking this customer&rsquo;s active orders…
                              </p>
                            )}
                            {customerOrderEligibility.isError && (
                              <div className="flex items-center gap-2 text-destructive">
                                <span>
                                  Could not check order eligibility. Try again.
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void customerOrderEligibility.refetch()
                                  }
                                >
                                  Retry
                                </Button>
                              </div>
                            )}
                            {customerOrderEligibility.data?.eligible && (
                              <p className="text-muted-foreground">
                                Active orders:{" "}
                                {
                                  customerOrderEligibility.data.activeOrderCount
                                }{" "}
                                of{" "}
                                {
                                  customerOrderEligibility.data.maxActiveOrders
                                }
                                .
                              </p>
                            )}
                            {customerOrderEligibility.data &&
                              !customerOrderEligibility.data.eligible && (
                                <div className="space-y-2"><p className="text-destructive">{customerOrderEligibility.data.message}</p><Button type="button" variant="outline" size="sm" disabled={customerOrderEligibility.isFetching} onClick={() => void customerOrderEligibility.refetch()}>Check eligibility again</Button></div>
                              )}
                          </div>
                        )}
                      </Field>
                    </Combobox>
                  )}
                />

                {selectedCustomer && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="customer_address">
                        Customer Phone (Read Only)
                      </FieldLabel>
                      <Input
                        type="text"
                        value={selectedCustomer.phone_number}
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
                        value={selectedCustomer.company_name}
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
                        if (value === "same-as-shipping-address") {
                          const savedAddresses =
                            selectedCustomer?.addresses ?? [];
                          if (
                            form.getValues("customer_address_id") === undefined &&
                            savedAddresses.length === 1
                          ) {
                            form.setValue(
                              "customer_address_id",
                              savedAddresses[0]?.id,
                              { shouldValidate: true },
                            );
                          }
                        }
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
                            <FieldTitle>
                              Use customer&rsquo;s saved address
                            </FieldTitle>
                          </FieldContent>
                          <RadioGroupItem
                            value="same-as-shipping-address"
                            id="same-as-shipping-address"
                            disabled={
                              (selectedCustomer?.addresses.length ?? 0) === 0
                            }
                          />
                        </Field>
                      </FieldLabel>

                      <FieldLabel htmlFor="different-address">
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldTitle>Enter a different address</FieldTitle>
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

                {!isCustomShipping && selectedCustomer && (
                  <Controller
                    name="customer_address_id"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="customer_address_id">
                          Saved shipping address
                          <span className="text-destructive">*</span>
                        </FieldLabel>
                        {selectedCustomer.addresses.length > 0 ? (
                          <Select
                            value={field.value ? String(field.value) : ""}
                            onValueChange={(value) => {
                              if (value !== null) field.onChange(Number(value));
                            }}
                          >
                            <SelectTrigger
                              id="customer_address_id"
                              className="w-full"
                              aria-invalid={fieldState.invalid}
                            >
                              <SelectValue placeholder="Choose a saved address" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {selectedCustomer.addresses.map(
                                  (customerAddress) => (
                                    <SelectItem
                                      key={customerAddress.id}
                                      value={String(customerAddress.id)}
                                    >
                                      {formatCustomerAddress(customerAddress)}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No saved address is available. Choose &ldquo;Enter
                            a different address&rdquo;.
                          </p>
                        )}
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                        {savedShippingAddress && (
                          <p className="text-xs text-muted-foreground">
                            This address will be saved with the order.
                          </p>
                        )}
                      </Field>
                    )}
                  />
                )}

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

                {isCustomShipping && <div className="grid gap-3 sm:grid-cols-2">
                  <p className="text-sm text-muted-foreground sm:col-span-2">Destination coordinates are optional now and must be confirmed before delivery scheduling.</p>
                  {(["shipping_latitude", "shipping_longitude"] as const).map((name) => <Controller key={name} name={name} control={form.control} render={({ field, fieldState }) => <Field>
                    <FieldLabel htmlFor={name}>{name === "shipping_latitude" ? "Latitude" : "Longitude"}</FieldLabel>
                    <Input id={name} type="number" step="any" min={name === "shipping_latitude" ? -90 : -180} max={name === "shipping_latitude" ? 90 : 180} value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value === "" ? undefined : event.target.valueAsNumber)} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>} />)}
                </div>}
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
                {form.formState.errors.items?.message && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.items.message}
                  </p>
                )}
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
                              {item.price === undefined
                                ? "Unverified"
                                : formatCurrency(item.price)}
                            </TableCell>
                            <TableCell>{item.quantity || "—"}</TableCell>
                            <TableCell>
                              {item.price === undefined
                                ? "Unverified"
                                : formatCurrency(item.price * item.quantity)}
                            </TableCell>
                            <TableCell>
                              <Button aria-label={`Edit item ${item.product_variant_sku}`}
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSub({
                                    id: item.inventory_id,
                                    is_open: true,
                                    mode: DialogMode.EDIT,
                                  });
                                }}
                              >
                                <Edit className="size-4" />
                              </Button>
                              <Button aria-label={`Remove item ${item.product_variant_sku}`}
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
                  {reviewTotal === null
                    ? "Unverified"
                    : formatCurrency(reviewTotal ?? 0)}
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
                        <SelectTrigger id="payment_arrangement">
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
                        <SelectTrigger id="payment_method">
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
                      min={0}
                      step={0.01}
                      max={reviewTotal ?? undefined}
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
                  {reviewTotal === null
                    ? "Unverified"
                    : formatCurrency(reviewTotal ?? 0)}
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
                  <h3 className="font-semibold">Order summary</h3>
                  <p className="text-sm text-muted-foreground">
                    Check the customer, destination, items and payment before creating the order.
                  </p>
                </div>

                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">Customer & delivery details</h4><Button type="button" variant="outline" size="sm" disabled={form.formState.isSubmitting} onClick={() => setStep(0)}>Edit details</Button></div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ReviewItem
                      label="Warehouse"
                      value={
                        warehouseCB.inputValue ||
                        (reviewWarehouseId > 0
                          ? `Warehouse #${reviewWarehouseId}`
                          : "")
                      }
                    />
                    <ReviewItem
                      label="Customer"
                      value={
                        customerCB.inputValue ||
                        (reviewCustomerId > 0
                          ? `Customer #${reviewCustomerId}`
                          : "")
                      }
                    />
                    <ReviewItem
                      label="Delivery Type"
                      value="Assigned when scheduling"
                    />
                    <ReviewItem
                      label="Payment Arrangement"
                      value={formatReviewValue(reviewPaymentArrangement)}
                    />
                    <ReviewItem label="Address source" value={reviewIsCustomShipping ? "Custom delivery address" : "Saved customer address"} />
                    <ReviewItem
                      label="Shipping Address"
                      value={
                        reviewIsCustomShipping
                          ? (reviewValues.shipping_address ?? "")
                          : savedShippingAddress
                      }
                    />
                    {reviewIsCustomShipping && (
                      <>
                        <ReviewItem
                          label="Shipping Recipient"
                          value={reviewValues.shipping_recipient ?? ""}
                        />
                        <ReviewItem
                          label="Shipping Phone"
                          value={reviewValues.shipping_phone ?? ""}
                        />
                      </>
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">Order items ({items?.length ?? 0})</h4><Button type="button" variant="outline" size="sm" disabled={form.formState.isSubmitting} onClick={() => setStep(1)}>Edit items</Button></div>
                  <div className="overflow-hidden rounded-lg border">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead>Item</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">
                              Quantity
                            </TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items?.map((item) => (
                            <TableRow key={item.inventory_id}>
                              <TableCell>
                                <div className="font-medium">
                                  {item.product_variant_name || "—"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {item.description || "—"}
                                </div>
                              </TableCell>
                              <TableCell>
                                {item.product_variant_sku || "—"}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {item.price === undefined
                                  ? "Unverified"
                                  : formatCurrency(item.price)}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.quantity}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {item.price === undefined
                                  ? "Unverified"
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

                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">Payment summary</h4><Button type="button" variant="outline" size="sm" disabled={form.formState.isSubmitting} onClick={() => setStep(2)}>Edit payment</Button></div>
                <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <ReviewItem
                    label="Payment Method"
                    value={formatReviewValue(reviewPaymentMethod)}
                  />
                  <ReviewItem
                    label="Amount Paid"
                    value={formatCurrency(reviewAmountPaid ?? 0)}
                  />
                  <ReviewItem
                    label="Total Order Value"
                    value={reviewTotal === null ? "Unverified" : formatCurrency(reviewTotal ?? 0)}
                  />
                  <ReviewItem label="Remaining balance" value={reviewTotal === null ? "Unverified" : formatCurrency(Math.max(0, Math.round((reviewTotal ?? 0) * 100) - Math.round((reviewAmountPaid ?? 0) * 100)) / 100)} />
                </section>

                {reviewNotes && (
                  <>
                    <Separator />
                    <ReviewItem label="Notes" value={reviewNotes} />
                  </>
                )}

                <p className="text-xs text-muted-foreground">
                  Creating the order saves these item and delivery details. Driver and vehicle assignments are made later in Delivery schedules.
                </p>
              </div>
            </>
          )}
        </form>
      </div>
    </>
  );
}
