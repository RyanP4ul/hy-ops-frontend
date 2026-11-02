"use client";

import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useDeliverySchedule } from "../provider";
import { useWebSocket } from "@/components/providers/websocket-provider";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDownIcon,
  ClipboardCheck,
  Plus,
  Trash2,
  Truck,
  Calendar as CalendarIcon,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Loader2,
  FileText,
  Move,
  CheckCircle2Icon,
} from "lucide-react";
import { PaginatedCombobox } from "@/components/paginated-combobox";
import {
  sumKnownMoney,
  isFutureManilaDeparture,
  manilaCalendarNow,
  formatCurrency,
} from "@/utils/date-util";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DialogMode } from "@/types/dialog";
import { DeliveryScheduleFormData } from "@/schema/delivery-schedule";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Controller } from "react-hook-form";
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
import { request, requestWithErrorHandling } from "@/components/http";
import { REQUESTS } from "@/constant/request";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEffect, useState } from "react";
import { QueryFeedback } from "@/components/query-feedback";
import { WorkflowStepper, WorkflowSummary, type WorkflowStep } from "@/components/workflow-stepper";

export default function DeliveryScheduleDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const {
    form,
    step,
    setStep,
    sub,
    setSub,
    orderDetailQuery,
    availableDateQuery,
    warehouseCB,
    orderCB,
    driverCB,
    vehicleCB,
    warehouseQuery,
    driverQuery,
    vehicleQuery,
    sortDistanceMutation,
    driverExpensesMutation,
  } = useDeliverySchedule();
  const queryClient = useQueryClient();
  const reviewOrders = orderDetailQuery.data ?? [];

  const reviewScheduledDate = form.watch("scheduled_date");
  const reviewScheduledTime = form.watch("scheduled_time");
  const reviewDeliveryType = form.watch("delivery_type");
  const delivery_allowance = form.watch("delivery_allowance");
  const fuel = form.watch("fuel");
  const toll = form.watch("toll");

  const reviewOrderTotal = sumKnownMoney(
    reviewOrders.map((order) => order.total),
  );

  useEffect(() => {
    setStep(0);
  }, [state.mode]);

  function moveItem(index: number, direction: -1 | 1) {
    const currentItems = orderDetailQuery.data;
    const currentOrderIds = form.getValues("order_ids");
    const targetIndex = index + direction;

    if (
      !currentItems ||
      targetIndex < 0 ||
      targetIndex >= currentItems.length ||
      targetIndex >= currentOrderIds.length
    ) {
      return;
    }

    const nextItems = [...currentItems];
    [nextItems[index], nextItems[targetIndex]] = [
      nextItems[targetIndex],
      nextItems[index],
    ];

    const nextOrderIds = [...currentOrderIds];
    [nextOrderIds[index], nextOrderIds[targetIndex]] = [
      nextOrderIds[targetIndex],
      nextOrderIds[index],
    ];

    form.setValue("order_ids", nextOrderIds, {
      shouldDirty: true,
      shouldValidate: true,
    });

    queryClient.setQueryData(["order_detail", nextOrderIds], nextItems);
  }

  const steps: WorkflowStep[] = [
    { title: "Warehouse", description: "Choose where this delivery run will start.", icon: ClipboardCheck,
      details: ["Orders, drivers and vehicles must belong to the selected warehouse.", "Check the warehouse before selecting orders for this run."] },
    { title: "Departure", description: "Choose the delivery date and departure time.", icon: CalendarIcon,
      details: ["All departure times use Manila time (UTC+8).", "Choose a future departure on a date with available delivery slots."] },
    { title: "Orders & stops", description: "Select the orders and arrange the delivery stops.", icon: ClipboardCheck,
      details: ["Check each customer's destination and map coordinates.", "Arrange stops in the order the driver should visit them."] },
    { title: "Driver & vehicle", description: "Choose a delivery type and assign the people and vehicle needed.", icon: Truck,
      details: ["Confirm the assigned driver and vehicle before continuing.", "Review availability for the selected departure before continuing."] },
    { title: "Expenses", description: "Review the allowance, fuel and toll estimates for this run.", icon: DollarSign,
      details: ["Calculate expenses after confirming the route and vehicle.", "Review the amounts before continuing. Estimates are separate from order totals."] },
    { title: "Review & schedule", description: "Confirm the departure, assignments, stops and expenses.", icon: ClipboardCheck,
      details: ["Return to an earlier step to correct details before scheduling.", "The schedule is submitted only when you select Create delivery schedule."] },
  ];
  const [nextPending, setNextPending] = useState(false);
  const draftOrderIds = form.watch("order_ids") ?? [];

  const fieldsByStep: (keyof DeliveryScheduleFormData)[][] = [
    ["warehouse_id"],
    ["scheduled_date", "scheduled_time"],
    ["order_ids"],
    ["delivery_type", "driver_id", "vehicle_id"],
    ["delivery_allowance", "fuel", "toll"],
  ];

  async function handleNext() {
    if (nextPending || form.formState.isSubmitting) return;
    setNextPending(true);
    try {
      const fields = fieldsByStep[step] ?? [];

      const isValid = await form.trigger([...fields], { shouldFocus: true });

      if (!isValid) {
        return;
      }

      if (step === 1) {
        const date = form.getValues("scheduled_date");
        if (
          !isFutureManilaDeparture(
            format(date, "yyyy-MM-dd"),
            form.getValues("scheduled_time"),
          )
        ) {
          form.setError("scheduled_time", {
            message: "Choose a future departure in Asia/Manila.",
          });
          return;
        }
      }
      if (
        step === 1 &&
        (availableDateQuery.isError ||
          availableDateQuery.isPending ||
          getAvailableSlotDate() < 1)
      ) {
        form.setError("scheduled_date", {
          message: "No available slots for the selected date.",
        });
        return;
      }

      setStep((current) => Math.min(current + 1, steps.length - 1));
    } finally {
      setNextPending(false);
    }
  }

  async function onSubmit(data: DeliveryScheduleFormData) {
    const response = await request("POST", `/api/deliveries`, {
      ...data,
      scheduled_date: format(data.scheduled_date, "yyyy-MM-dd"),
    });

    await requestWithErrorHandling(response, form, (result) => {
      void queryClient.invalidateQueries({
        queryKey: ["deliveryScheduleQuery"],
      });
      void queryClient.invalidateQueries({ queryKey: ["availableDateQuery"] });
      void queryClient.invalidateQueries({ queryKey: ["order"] });
      send({
        type: REQUESTS.DELIVERY_SCHEDULE_CREATED,
        payload: [
          JSON.stringify({
            id: result.id,
            order_ids: data.order_ids,
          }),
        ],
      });
      if (result.delivery) {
        send({
          type: REQUESTS.DELIVERY_CREATED,
          payload: [JSON.stringify(result.delivery)],
        });
      }
      form.reset();
      setStep(0);
      warehouseCB.setInputValue("");
      orderCB.setInputValue("");
      driverCB.setInputValue("");
      vehicleCB.setInputValue("");
      orderCB.setPage(0);
      driverCB.setPage(0);
      vehicleCB.setPage(0);
      dispatch({
        type: "CLOSE",
      });
    });
  }

  const getAvailableSlotDate = () => {
    const date = form.getValues("scheduled_date") || new Date();
    const dateKey = format(date, "yyyy-MM-dd");
    const day = availableDateQuery.data?.find((item) => item.date === dateKey);
    return day?.available_slots ?? 0;
  };

  return (
    <>
      <DialogContent className="sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>
        <WorkflowStepper label="Delivery schedule progress" steps={steps} current={step}
          disabled={nextPending || driverExpensesMutation.isPending || form.formState.isSubmitting}
          onBackToStep={setStep}
          summary={<WorkflowSummary items={[
            { label: "Warehouse", value: warehouseCB.inputValue || (form.watch("warehouse_id") > 0 ? `Warehouse #${form.getValues("warehouse_id")}` : "Choose a warehouse") },
            { label: "Departure (Manila)", value: reviewScheduledDate ? `${format(reviewScheduledDate, "MMM d, yyyy")} / ${reviewScheduledTime || "Choose a time"}` : "Choose a departure" },
            { label: "Orders", value: `${draftOrderIds.length} ${draftOrderIds.length === 1 ? "order" : "orders"} selected` },
            { label: "Vehicle", value: vehicleCB.inputValue || (form.watch("vehicle_id") > 0 ? `Vehicle #${form.getValues("vehicle_id")}` : "Not assigned") },
          ]} />}
        />

        {step === 0 && (
          <>
            <Controller
              name="warehouse_id"
              control={form.control}
              render={({ field, fieldState }) => (
                <PaginatedCombobox
                  key={sub.id}
                  id="product-variant"
                  label="Product Variant"
                  required
                  disabled={warehouseQuery.isFetching}
                  value={
                    field.value && field.value > 0 ? String(field.value) : null
                  }
                  selectedLabel={warehouseCB.inputValue}
                  options={warehouseQuery.data?.rows ?? []}
                  getOptionValue={(productVariant) => String(productVariant.id)}
                  renderOption={(productVariant) => (
                    <Item size="xs" className="p-0">
                      <ItemContent>
                        <ItemTitle className="whitespace-nowrap">
                          {productVariant.name}
                        </ItemTitle>
                      </ItemContent>
                    </Item>
                  )}
                  onValueChange={(value, selectedProductVariant) => {
                    warehouseCB.setInputValue(
                      selectedProductVariant?.name ?? "",
                    );
                    field.onChange(value ? Number(value) : null);
                  }}
                  onSearchChange={warehouseCB.setSearchQuery}
                  page={warehouseCB.page}
                  totalPages={Math.max(
                    1,
                    Math.ceil((warehouseQuery.data?.total ?? 0) / 10),
                  )}
                  onPageChange={warehouseCB.setPage}
                  isLoading={warehouseQuery.isFetching}
                  invalid={fieldState.invalid}
                  error={
                    fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )
                  }
                  placeholder="Select warehouse name..."
                  emptyMessage="All product variants are already in this warehouse inventory, or no variants match."
                />
                // <Combobox
                //   open={warehouseCB.open}
                //   onOpenChange={(open) => warehouseCB.setOpen(open)}
                //   value={field.value ? String(field.value) : ""}
                //   onValueChange={(value) => {
                //     const selectedWarehouse = warehouseQuery.data?.rows?.find(
                //       (warehouse) => warehouse.id === Number(value),
                //     );
                //
                //     warehouseCB.setInputValue(selectedWarehouse?.name ?? "");
                //
                //     if (Number(value) !== field.value) {
                //       form.setValue("order_ids", []);
                //       form.setValue("driver_id", -1);
                //       form.setValue("vehicle_id", -1);
                //       driverCB.setInputValue(""); vehicleCB.setInputValue("");
                //       orderCB.setPage(0); driverCB.setPage(0); vehicleCB.setPage(0);
                //     }
                //     field.onChange(value ? Number(value) : null);
                //   }}
                // >
                //   <Field data-invalid={fieldState.invalid}>
                //     <FieldLabel htmlFor="warehouse-name">
                //       Warehouse<span className="text-destructive">*</span>
                //     </FieldLabel>
                //
                //     <ComboboxInput
                //       placeholder="Select warehouse name..."
                //       value={warehouseCB.inputValue}
                //       disabled={warehouseQuery.isFetching}
                //       aria-invalid={fieldState.invalid}
                //       readOnly
                //     />
                //     <ComboboxContent>
                //       <ComboboxList>
                //         {warehouseQuery.data?.rows?.map((productVariant) => (
                //           <ComboboxItem
                //             key={productVariant.id}
                //             value={String(productVariant.id)}
                //           >
                //             <Item size="xs" className="p-0">
                //               <ItemContent>
                //                 <ItemTitle className="whitespace-nowrap">
                //                   ({productVariant.id}) {productVariant.name}
                //                 </ItemTitle>
                //
                //               </ItemContent>
                //             </Item>
                //           </ComboboxItem>
                //         ))}
                //
                //         {warehouseQuery.isFetching && (
                //           <div className="px-2 py-1 text-xs text-muted-foreground">
                //             Loading...
                //           </div>
                //         )}
                //
                //         {!warehouseQuery.isFetching &&
                //           warehouseQuery.data?.rows?.length === 0 && (
                //             <ComboboxEmpty>No found.</ComboboxEmpty>
                //           )}
                //       </ComboboxList>
                //
                //       <div className="flex items-center justify-between border-t p-2">
                //         <Button
                //           type="button"
                //           variant="ghost"
                //           size="sm"
                //           disabled={
                //             warehouseCB.page <= 0 || warehouseQuery.isFetching
                //           }
                //           onClick={() => warehouseCB.setPage((p) => p - 1)}
                //         >
                //           Previous
                //         </Button>
                //
                //         <span className="text-muted-foreground text-xs">
                //           {warehouseCB.page + 1} / {warehouseCB.totalPages}
                //         </span>
                //
                //         <Button
                //           type="button"
                //           variant="ghost"
                //           size="sm"
                //           disabled={
                //             warehouseCB.page + 1 >= warehouseCB.totalPages ||
                //             warehouseQuery.isFetching
                //           }
                //           onClick={() => {
                //             warehouseCB.setPage((p) => p + 1);
                //           }}
                //         >
                //           Next
                //         </Button>
                //       </div>
                //     </ComboboxContent>
                //
                //     {fieldState.invalid && (
                //       <FieldError errors={[fieldState.error]} />
                //     )}
                //   </Field>
                // </Combobox>
              )}
            />
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm text-muted-foreground">
              Departure dates and times use Asia/Manila.
            </p>
            <QueryFeedback
              query={availableDateQuery}
              label="available schedule dates"
            />
            {form.getValues("scheduled_date") && (
              <Alert>
                <CheckCircle2Icon />
                <AlertTitle>Order Available</AlertTitle>
                <AlertDescription>
                  Available slots for{" "}
                  {format(form.getValues("scheduled_date"), "PPP")} is{" "}
                  <span className="font-semibold text-green-500 text-lg">
                    {getAvailableSlotDate()}{" "}
                  </span>
                  slot(s) left
                </AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Controller
                control={form.control}
                name="scheduled_date"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="scheduledDate">
                        Delivery Date{" "}
                        <span className="text-destructive">*</span>
                      </FieldLabel>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          field.onChange(startOfDay(manilaCalendarNow()))
                        }
                      >
                        now
                      </Button>
                    </div>
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            id="scheduledDate"
                            type="button"
                            variant="outline"
                            aria-invalid={fieldState.invalid}
                            className="w-48 justify-between font-normal"
                          >
                            {field.value
                              ? format(field.value, "PPP")
                              : "Select date"}
                            <ChevronDownIcon className="size-4" />
                          </Button>
                        }
                      />

                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={[
                            { before: startOfDay(manilaCalendarNow()) },
                            { dayOfWeek: [0] },
                            (date) => {
                              const dateKey = format(date, "yyyy-MM-dd");

                              const day = availableDateQuery.data?.find(
                                (item) => item.date === dateKey,
                              );

                              return !day || day.available_slots < 1;
                            },
                          ]}
                        />
                      </PopoverContent>
                    </Popover>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="scheduled_time"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="scheduled_time">
                      Departure Time <span className="text-destructive">*</span>
                    </FieldLabel>

                    <Input
                      {...field}
                      id="scheduled_time"
                      type="time"
                      step="60"
                      aria-invalid={fieldState.invalid}
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

        {step === 2 && (
          <>
            <QueryFeedback query={orderDetailQuery} label="selected orders" />
            <section className="space-y-3">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-semibold">
                    Orders <span className="text-destructive">*</span>
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select order to be delivered
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sortDistanceMutation.mutate()}
                    disabled={
                      sortDistanceMutation.isPending ||
                      form.getValues("order_ids").length < 2
                    }
                  >
                    {sortDistanceMutation.isPending ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Move className="mr-1.5 size-3.5" />
                    )}
                    Sort Order By Distance
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      setSub({
                        is_open: true,
                        mode: DialogMode.INSERT,
                      });
                    }}
                    disabled={
                      getAvailableSlotDate() < 1 ||
                      getAvailableSlotDate() -
                        form.getValues("order_ids").length <
                        1
                    }
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    Add Order
                  </Button>
                </div>
              </div>
              {form.formState.errors.order_ids?.message && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.order_ids?.message}
                </p>
              )}
              <div
                className={`overflow-hidden rounded-lg border ${form.formState.errors.order_ids ? "border-destructive" : "border-border"}`}
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="min-w-32.5">
                          Order Number
                        </TableHead>
                        <TableHead className="min-w-45">Company</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderDetailQuery.data?.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.order_number || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.customer_company || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">
                            {item.item_count}
                          </TableCell>
                          <TableCell>{item.destination || "—"}</TableCell>
                          <TableCell>
                            {item.total === null
                              ? "Unverified"
                              : formatCurrency(item.total)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={index === 0}
                              onClick={() => {
                                moveItem(index, -1);
                              }}
                            >
                              <ArrowUp className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={
                                index ===
                                (orderDetailQuery.data || []).length - 1
                              }
                              onClick={() => moveItem(index, 1)}
                            >
                              <ArrowDown className="size-4" />
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
                      {(orderDetailQuery?.data || []).length < 1 && (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="h-24 text-center text-sm text-muted-foreground"
                          >
                            No orders selected yet. Add an order to build this delivery run.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {(orderDetailQuery.data || []).length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Stops are visited from top to bottom. Use the up and down arrows to change their order before continuing.
                </p>
              )}
            </section>
          </>
        )}

        {step === 3 && (
          <>
            <QueryFeedback query={driverQuery} label="drivers" />
            <QueryFeedback query={vehicleQuery} label="vehicles" />
            <Controller
              name="delivery_type"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="delivery_type">
                    Delivery Type <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="LALAMOVE">Lalamove</SelectItem>
                        <SelectItem value="PICKUP">Customer pickup</SelectItem>
                        <SelectItem value="INTERNAL">
                          Company delivery
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Controller
              name="driver_id"
              control={form.control}
              render={({ field, fieldState }) => (
                <Combobox
                  open={driverCB.open}
                  onOpenChange={(open) => driverCB.setOpen(open)}
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(value) => {
                    const selectedOrder = driverQuery.data?.rows?.find(
                      (order) => order.id === Number(value),
                    );

                    driverCB.setInputValue(selectedOrder?.name ?? "");

                    field.onChange(value ? Number(value) : null);
                  }}
                >
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="driver_id">
                      Driver <span className="text-destructive">*</span>
                    </FieldLabel>

                    <ComboboxInput
                      placeholder="Select driver..."
                      value={driverCB.inputValue}
                      disabled={driverQuery.isFetching}
                      aria-invalid={fieldState.invalid}
                      readOnly
                    />
                    <ComboboxContent>
                      <ComboboxList>
                        {driverQuery.data?.rows?.map((driver) => (
                          <ComboboxItem
                            key={driver.id}
                            value={String(driver.id)}
                          >
                            <Item size="xs" className="p-0">
                              <ItemContent>
                                <ItemTitle className="whitespace-nowrap">
                                  ({driver.id}) {driver.name}
                                </ItemTitle>
                                <ItemDescription>
                                  {driver.phone_number}
                                </ItemDescription>
                              </ItemContent>
                            </Item>
                          </ComboboxItem>
                        ))}

                        {driverQuery.isFetching && (
                          <div className="px-2 py-1 text-xs text-muted-foreground">
                            Loading...
                          </div>
                        )}

                        {!driverQuery.isFetching &&
                          driverQuery.data?.rows?.length === 0 && (
                            <ComboboxEmpty>No found.</ComboboxEmpty>
                          )}
                      </ComboboxList>

                      <div className="flex items-center justify-between border-t p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            driverCB.page <= 0 || driverQuery.isFetching
                          }
                          onClick={() => driverCB.setPage((p) => p - 1)}
                        >
                          Previous
                        </Button>

                        <span className="text-muted-foreground text-xs">
                          {driverCB.page + 1} / {driverCB.totalPages}
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            driverCB.page + 1 >= driverCB.totalPages ||
                            driverQuery.isFetching
                          }
                          onClick={() => {
                            driverCB.setPage((p) => p + 1);
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
              name="vehicle_id"
              control={form.control}
              render={({ field, fieldState }) => (
                <Combobox
                  open={vehicleCB.open}
                  onOpenChange={(open) => vehicleCB.setOpen(open)}
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(value) => {
                    const selected = vehicleQuery.data?.rows?.find(
                      (order) => order.id === Number(value),
                    );

                    vehicleCB.setInputValue(selected?.plate_number ?? "");

                    field.onChange(value ? Number(value) : null);
                  }}
                >
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="vehicle_id">
                      Vehicle<span className="text-destructive">*</span>
                    </FieldLabel>

                    <ComboboxInput
                      placeholder="Select vehicle..."
                      value={vehicleCB.inputValue}
                      disabled={vehicleQuery.isFetching}
                      aria-invalid={fieldState.invalid}
                      readOnly
                    />
                    <ComboboxContent>
                      <ComboboxList>
                        {vehicleQuery.data?.rows?.map((order) => (
                          <ComboboxItem key={order.id} value={String(order.id)}>
                            <Item size="xs" className="p-0">
                              <ItemContent>
                                <ItemTitle className="whitespace-nowrap">
                                  ({order.id}) {order.type}
                                </ItemTitle>
                                <ItemDescription>
                                  {order.plate_number}
                                </ItemDescription>
                              </ItemContent>
                            </Item>
                          </ComboboxItem>
                        ))}

                        {vehicleQuery.isFetching && (
                          <div className="px-2 py-1 text-xs text-muted-foreground">
                            Loading...
                          </div>
                        )}

                        {!vehicleQuery.isFetching &&
                          vehicleQuery.data?.rows?.length === 0 && (
                            <ComboboxEmpty>No found.</ComboboxEmpty>
                          )}
                      </ComboboxList>

                      <div className="flex items-center justify-between border-t p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            vehicleCB.page <= 0 || vehicleQuery.isFetching
                          }
                          onClick={() => vehicleCB.setPage((p) => p - 1)}
                        >
                          Previous
                        </Button>

                        <span className="text-muted-foreground text-xs">
                          {vehicleCB.page + 1} / {vehicleCB.totalPages}
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            vehicleCB.page + 1 >= vehicleCB.totalPages ||
                            vehicleQuery.isFetching
                          }
                          onClick={() => {
                            vehicleCB.setPage((p) => p + 1);
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
          </>
        )}

        {step === 4 && (
          <>
            <div className="space-y-4">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-semibold">Estimated Expenses</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Calculate an estimate, then review the allowance, fuel and toll amounts.
                  </p>
                </div>

                <Button
                  size="lg"
                  onClick={() => driverExpensesMutation.mutate()}
                  disabled={driverExpensesMutation.isPending}
                >
                  {driverExpensesMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  Calculate Driver Expenses
                </Button>
              </div>

              {driverExpensesMutation.data && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Distance</p>
                      <p className="mt-1 font-medium">
                        {driverExpensesMutation.data?.route.distanceKm.toFixed(
                          2,
                        ) || "0.00"}{" "}
                        km
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="mt-1 font-medium">
                        {driverExpensesMutation.data?.route.durationMinutes ||
                          "0"}{" "}
                        minutes
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">
                        Fuel Liters
                      </p>
                      <p className="mt-1 font-medium">
                        {driverExpensesMutation.data?.expenses.estimatedFuelLiters.toFixed(
                          2,
                        ) || "0.00"}{" "}
                        L
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Has Tolls</p>
                      <p className="mt-1 font-medium">
                        {driverExpensesMutation.data?.tollDetection.status ===
                        "DETECTED"
                          ? "Yes"
                          : "No"}
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <Controller
                  control={form.control}
                  name="delivery_allowance"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="delivery_allowance">
                        Delivery allowance (PHP){" "}
                        <span className="text-destructive">*</span>
                      </FieldLabel>

                      <Input
                        {...field}
                        id="delivery_allowance"
                        type="number"
                        disabled={driverExpensesMutation.isPending}
                        aria-invalid={fieldState.invalid}
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

                <Controller
                  control={form.control}
                  name="fuel"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="fuel">
                        Fuel amount (PHP) <span className="text-destructive">*</span>
                      </FieldLabel>

                      <Input
                        {...field}
                        id="fuel"
                        type="number"
                        disabled={driverExpensesMutation.isPending}
                        aria-invalid={fieldState.invalid}
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

                <Controller
                  control={form.control}
                  name="toll"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="toll">Toll amount (PHP)</FieldLabel>

                      <Input
                        {...field}
                        id="toll"
                        type="number"
                        disabled={
                          driverExpensesMutation.isPending ||
                          driverExpensesMutation.data?.tollDetection.status !==
                            "DETECTED"
                        }
                        aria-invalid={fieldState.invalid}
                        onChange={(event) => {
                          field.onChange(event.target.valueAsNumber);
                        }}
                      />

                      <FieldDescription>
                        Toll entry is available when the route calculation detects tolls. Review the estimate before scheduling.
                      </FieldDescription>

                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Total Driver Expenses
                  </p>
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-2xl font-semibold">
                  {formatCurrency(delivery_allowance + fuel + toll)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Allowance, fuel and toll estimates for this delivery run. Order values are shown separately.
                </p>
              </div>
            </div>
          </>
        )}

        {step === 5 && (
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Review delivery schedule</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirm the delivery details before submitting.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Delivery date</p>
                <p className="mt-1 font-medium">
                  {reviewScheduledDate
                    ? format(reviewScheduledDate, "PPP")
                    : "Not selected"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Departure time (Manila)</p>
                <p className="mt-1 font-medium">
                  {reviewScheduledTime || "Not selected"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Delivery type</p>
                <p className="mt-1 font-medium">
                  {reviewDeliveryType === "LALAMOVE"
                    ? "Lalamove"
                    : reviewDeliveryType === "PICKUP"
                      ? "Customer pickup"
                      : "Company delivery"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Order total</p>
                <p className="mt-1 font-medium">
                  {reviewOrderTotal === null
                    ? "Unverified"
                    : formatCurrency(reviewOrderTotal)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Warehouse</p>
                <p className="mt-1 font-medium">
                  {warehouseCB.inputValue || "Not selected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Warehouse:{" "}
                  {form.getValues("warehouse_id") > 0
                    ? form.getValues("warehouse_id")
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Driver</p>
                <p className="mt-1 font-medium">
                  {driverCB.inputValue || "Not selected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  ID:{" "}
                  {form.getValues("driver_id") > 0
                    ? form.getValues("driver_id")
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Vehicle</p>
                <p className="mt-1 font-medium">
                  {vehicleCB.inputValue || "Not selected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  ID:{" "}
                  {form.getValues("vehicle_id") > 0
                    ? form.getValues("vehicle_id")
                    : "—"}
                </p>
              </div>
            </div>

            <section className="space-y-3 rounded-lg border p-4" aria-label="Delivery expense review">
              <h4 className="text-sm font-semibold">Estimated delivery expenses</h4>
              <WorkflowSummary items={[
                { label: "Allowance", value: formatCurrency(delivery_allowance) },
                { label: "Fuel", value: formatCurrency(fuel) },
                { label: "Toll", value: formatCurrency(toll) },
                { label: "Total expenses", value: formatCurrency(delivery_allowance + fuel + toll) },
              ]} />
              <p className="text-xs text-muted-foreground">These expenses are separate from the customer order total.</p>
            </section>
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Delivery stops ({reviewOrders.length})</h4><Button type="button" variant="outline" size="sm" disabled={form.formState.isSubmitting} onClick={() => setStep(2)}>Edit orders & stops</Button></div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Order Number</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.order_number || "—"}</TableCell>
                      <TableCell>{order.customer_company || "—"}</TableCell>
                      <TableCell>{order.destination || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {order.item_count}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.total === null
                          ? "Unverified"
                          : formatCurrency(order.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {reviewOrders.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-20 text-center text-sm text-muted-foreground"
                      >
                        No orders selected.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {reviewOrders.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>Total</TableCell>
                      <TableCell className="text-right">
                        {reviewOrderTotal === null
                          ? "Unverified"
                          : formatCurrency(reviewOrderTotal)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </section>
        )}

        {form.formState.errors.root?.message && (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}
        <DialogFooter className="sticky -bottom-4 z-20 flex-wrap items-center rounded-lg border bg-background/95 p-3 backdrop-blur-sm">
          <p className="w-full text-xs text-muted-foreground sm:mr-auto sm:w-auto">{step === steps.length - 1 ? "Check the complete delivery plan before scheduling." : `Step ${step + 1} of ${steps.length} / Changes are not saved yet.`}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0 || nextPending || driverExpensesMutation.isPending || form.formState.isSubmitting}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          {step < steps.length - 1 && (
            <Button
              type="button"
              className="h-auto min-h-10 min-w-0 whitespace-normal text-left"
              onClick={handleNext}
              disabled={nextPending || driverExpensesMutation.isPending || form.formState.isSubmitting}
            >
              {nextPending ? "Checking details..." : `Continue to ${steps[step + 1].title.toLowerCase()}`}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          )}
          {step === steps.length - 1 && (
            <>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                onClick={form.handleSubmit(onSubmit)}
              >
                {form.formState.isSubmitting ? "Creating schedule..." : "Create delivery schedule"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </>
  );
}
