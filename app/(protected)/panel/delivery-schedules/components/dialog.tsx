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
  ClipboardCheck,
  Plus,
  Trash2,
  Truck,
  Calendar as CalendarIcon,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Loader2,
  Move,
} from "lucide-react";
import { PaginatedCombobox } from "@/components/paginated-combobox";
import {
  sumKnownMoney,
  isFutureManilaDeparture,
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
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Controller } from "react-hook-form";
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
import { useState } from "react";
import { QueryFeedback } from "@/components/query-feedback";
import { WorkflowSummary, type WorkflowStep } from "@/components/workflow-stepper";
import { formatTime12h } from "@/lib/departure-recommendations";

import { DepartureStep } from "./departure-step";
import { ExpensesStep } from "./expenses-step";
import { ScheduleWorkspace } from "./schedule-workspace";

export default function DeliveryScheduleDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const {
    isStaff,
    form,
    step,
    setStep,
    sub,
    setSub,
    orderDetailQuery,
    availableDateQuery,
    availableStopSlots,
    warehouseCB,
    orderCB,
    driverCB,
    vehicleCB,
    warehouseQuery,
    driverQuery,
    vehicleQuery,
    sortDistanceMutation,
    optimizeRouteMutation,
    driverExpensesMutation,
  } = useDeliverySchedule();
  const queryClient = useQueryClient();
  const reviewOrders = orderDetailQuery.data ?? [];
  const selectedVehicleId = form.watch("vehicle_id");
  const selectedVehicle = vehicleQuery.data?.rows?.find(
    (v) => v.id === selectedVehicleId,
  );
  const totalLoadWeightKg = reviewOrders.reduce(
    (sum, order) => sum + (Number(order.total_weight_kg) || 0),
    0,
  );
  const maxVehicleWeightKg =
    selectedVehicle?.max_weight_kg != null
      ? Number(selectedVehicle.max_weight_kg)
      : null;
  const loadRatio =
    maxVehicleWeightKg && maxVehicleWeightKg > 0
      ? totalLoadWeightKg / maxVehicleWeightKg
      : null;

  const reviewScheduledDate = form.watch("scheduled_date");
  const reviewScheduledTime = form.watch("scheduled_time");
  const delivery_allowance = form.watch("delivery_allowance");
  const fuel = form.watch("fuel");
  const toll = form.watch("toll");

  const reviewOrderTotal = sumKnownMoney(
    reviewOrders.map((order) => order.total),
  );

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
    { title: "Warehouse", description: isStaff ? "This delivery run starts from your assigned warehouse." : "Choose where this delivery run will start.", icon: ClipboardCheck,
      details: ["Orders, drivers and vehicles must belong to the selected warehouse.", "Check the warehouse before selecting orders for this run."] },
    { title: "Departure", description: "Choose the delivery date and departure time.", icon: CalendarIcon,
      details: ["All departure times use Manila time (UTC+8).", "Choose a future departure on a date with available delivery slots."] },
    { title: "Orders & stops", description: "Select the orders and arrange the delivery stops.", icon: ClipboardCheck,
      details: ["Check each customer's destination and map coordinates.", "Arrange stops in the order the driver should visit them."] },
    { title: "Driver & vehicle", description: "Assign the driver and vehicle for this company delivery run.", icon: Truck,
      details: ["Confirm the assigned driver and vehicle before continuing.", "Review availability for the selected departure before continuing."] },
    { title: "Expenses", description: "", icon: DollarSign,
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
    ["driver_id", "vehicle_id"],
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
          availableStopSlots < 1)
      ) {
        form.setError("scheduled_date", {
          message: "No available slots for the selected date.",
        });
        return;
      }

      if ((step === 1 || step === 2) && form.getValues("order_ids").length > availableStopSlots) {
        form.setError(step === 1 ? "scheduled_date" : "order_ids", { message: `This date has ${availableStopSlots} available stops. Choose a date with enough slots or remove orders. Groups must be scheduled together.` });
        return;
      }
      setStep((current) => Math.min(current + 1, steps.length - 1));
    } finally {
      setNextPending(false);
    }
  }

  async function onSubmit(data: DeliveryScheduleFormData) {
    const estimatedDuration = driverExpensesMutation.data?.route?.durationMinutes;
    const response = await request("POST", `/api/deliveries`, {
      ...data,
      delivery_type: "INTERNAL",
      scheduled_date: format(data.scheduled_date, "yyyy-MM-dd"),
      ...(estimatedDuration && estimatedDuration >= 15
        ? { estimated_duration_minutes: Math.min(1440, Math.round(estimatedDuration)) }
        : {}),
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
      driverExpensesMutation.reset();
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

  return (
    <>
      <DialogContent className="grid max-h-none max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 transition-none sm:max-w-none"
        style={{ width: "min(1180px, calc(100vw - 2rem))", maxWidth: "calc(100vw - 2rem)", height: "min(900px, calc(100dvh - 2rem))", maxHeight: "calc(100dvh - 2rem)" }}>
        <DialogHeader className="border-b px-4 py-5 pr-12 sm:px-7">
          <div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background"><Truck className="size-5" /></span>
            <div className="min-w-0"><DialogTitle>Schedule delivery</DialogTitle><DialogDescription className="mt-1">Plan your route, assign a driver, and schedule orders together.</DialogDescription></div></div>
        </DialogHeader>
        <ScheduleWorkspace disabled={nextPending || driverExpensesMutation.isPending || form.formState.isSubmitting}
          title={steps[step].title} description={steps[step].description}>

        {step === 0 && (
          <>
            {isStaff && <div><QueryFeedback query={warehouseQuery} label="assigned warehouse" />{warehouseQuery.isError && <p role="alert" className="mt-2 text-sm text-destructive">{warehouseQuery.error.message}</p>}{warehouseCB.inputValue && <p className="text-sm">Assigned warehouse: {warehouseCB.inputValue}</p>}</div>}
            {!isStaff && <Controller
              name="warehouse_id"
              control={form.control}
              render={({ field, fieldState }) => (
                <PaginatedCombobox
                  key={sub.id}
                  id="warehouse"
                  label="Warehouse"
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
                    if (Number(value) !== field.value) {
                      form.setValue("order_ids", []);
                      form.setValue("driver_id", -1); form.setValue("vehicle_id", -1);
                      form.setValue("scheduled_date", undefined as unknown as Date);
                      form.setValue("scheduled_time", "");
                      form.setValue("delivery_allowance", 0); form.setValue("fuel", 0); form.setValue("toll", 0);
                      driverCB.setInputValue(""); vehicleCB.setInputValue("");
                      orderCB.setPage(0); driverCB.setPage(0); vehicleCB.setPage(0);
                    }
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
                  emptyMessage="No warehouses found."
                />

              )}
            />}
          </>
        )}

        {step === 1 && <DepartureStep />}

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
                    Add orders and complete groups, then arrange the delivery stops.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => optimizeRouteMutation.mutate()}
                    disabled={
                      optimizeRouteMutation.isPending ||
                      form.getValues("order_ids").length < 2
                    }
                  >
                    {optimizeRouteMutation.isPending ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Move className="mr-1.5 size-3.5" />
                    )}
                    Optimize Stop Order
                  </Button>
                  <Button
                    type="button"
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
                    Sort By Distance
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={() => {
                      orderCB.debouncedSearch.cancel();
                      orderCB.setInputValue("");
                      orderCB.setSearchQuery("");
                      orderCB.setPage(0);
                      setSub({
                        is_open: true,
                        mode: DialogMode.INSERT,
                      });
                    }}
                    disabled={draftOrderIds.length >= availableStopSlots}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    Add orders
                  </Button>
                </div>
              </div>
              {form.formState.errors.order_ids?.message && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.order_ids?.message}
                </p>
              )}
              <ol aria-label="Delivery stop order" className="space-y-3">
                {reviewOrders.map((item, index) => <li key={item.id} className="rounded-xl border bg-background p-3 sm:p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{index + 1}</span>
                    <div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold">{item.order_number}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.customer_company || "Customer"}</p></div>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <Button type="button" variant="outline" size="icon" className="size-8" aria-label={`Move ${item.order_number} up`} disabled={index === 0} onClick={() => moveItem(index, -1)}><ArrowUp className="size-3.5" /></Button>
                      <Button type="button" variant="outline" size="icon" className="size-8" aria-label={`Move ${item.order_number} down`} disabled={index === reviewOrders.length - 1} onClick={() => moveItem(index, 1)}><ArrowDown className="size-3.5" /></Button>
                      {(!item.order_group_id || index === reviewOrders.findIndex(member => member.order_group_id === item.order_group_id)) && <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Remove ${item.order_group_number ? `group ${item.order_group_number}` : item.order_number}`} onClick={() => setSub({ id: index, is_open: true, mode: DialogMode.DELETE })}><Trash2 className="size-3.5" /></Button>}
                    </div>
                  </div>
                  {item.order_group_number && <p className="mt-3 break-all text-xs text-muted-foreground">Group {item.order_group_number} / Order {item.order_group_position} of {item.order_group_size}</p>}
                  <div className="mt-3 rounded-lg bg-muted/40 p-3"><p className="mb-1 text-[11px] font-medium text-muted-foreground">SAVED DESTINATION</p><p className="break-words text-sm leading-relaxed">{item.destination || "Destination unavailable"}</p></div>
                  <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs"><span className="text-muted-foreground">{item.item_count} {item.item_count === 1 ? "item" : "items"}</span><span className="font-semibold">{item.total === null ? "Unverified total" : formatCurrency(item.total)}</span></div>
                </li>)}
              </ol>
              {!reviewOrders.length && <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No orders selected yet. Add orders to build this delivery run.</div>}
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
                                  {order.max_weight_kg
                                    ? ` · Max ${Number(order.max_weight_kg).toLocaleString()} kg`
                                    : ""}
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
            {reviewOrders.length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Estimated cargo load</span>
                  <span className="font-semibold tabular-nums">
                    {totalLoadWeightKg.toFixed(1)} kg
                    {maxVehicleWeightKg !== null
                      ? ` / ${maxVehicleWeightKg.toFixed(1)} kg (${Math.round((loadRatio ?? 0) * 100)}%)`
                      : " (vehicle capacity not set)"}
                  </span>
                </div>
                {loadRatio !== null && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        loadRatio > 1
                          ? "h-full bg-destructive transition-all"
                          : loadRatio >= 0.85
                            ? "h-full bg-amber-500 transition-all"
                            : "h-full bg-emerald-600 transition-all"
                      }
                      style={{ width: `${Math.min(100, Math.round(loadRatio * 100))}%` }}
                    />
                  </div>
                )}
                {loadRatio !== null && loadRatio > 1 && (
                  <p role="alert" className="text-destructive font-medium">
                    Cargo weight exceeds {selectedVehicle?.plate_number}&apos;s configured payload limit. Choose a larger vehicle or split orders.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {step === 4 && <ExpensesStep />}

        {step === 5 && (
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Review delivery schedule</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirm the delivery details before submitting.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
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
                <p className="mt-1 font-medium tabular-nums">
                  {reviewScheduledTime ? formatTime12h(reviewScheduledTime) : "Not selected"}
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
                      <TableCell className="min-w-36 max-w-52 whitespace-normal break-words">{order.order_number || "-"}{order.order_group_number && <p className="mt-1 text-xs text-muted-foreground">{order.order_group_number} / {order.order_group_position} of {order.order_group_size}</p>}</TableCell>
                      <TableCell>{order.customer_company || "—"}</TableCell>
                      <TableCell className="min-w-40 max-w-64 whitespace-normal break-words">{order.destination || "-"}</TableCell>
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
        </ScheduleWorkspace>
        <DialogFooter className="mx-0 mb-0 flex-row flex-wrap items-center gap-2 rounded-none border-t bg-background px-4 py-4 sm:px-7">
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
              aria-label={nextPending ? "Checking details..." : `Continue to ${steps[step + 1].title.toLowerCase()}`}
              onClick={handleNext}
              disabled={nextPending || driverExpensesMutation.isPending || form.formState.isSubmitting}
            >
              <span className="sm:hidden">{nextPending ? "Checking..." : "Continue"}</span>
              <span className="hidden sm:inline">{nextPending ? "Checking details..." : `Continue to ${steps[step + 1].title.toLowerCase()}`}</span>
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
