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
import { useDeliverySchedule } from "../provider";
import { useWebSocket } from "@/components/providers/websocket-provider";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDownIcon,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Edit,
  MapPin,
  Package,
  Plus,
  Trash2,
  Truck,
  Calendar as CalendarIcon,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { formatCurrency } from "@/utils/date-util";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCaption,
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
import { format, isSameDay, startOfDay } from "date-fns";
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
import { ToastSubmit } from "@/components/util";
import { request, requestWithErrorHandling } from "@/components/http";

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
    driverCB,
    vehicleCB,
    driverQuery,
    vehicleQuery,
  } = useDeliverySchedule();
  const queryClient = useQueryClient();

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

  const steps = [
    {
      title: "Order Selection",
      description: "Select order for delivery",
      icon: ClipboardCheck,
    },
    {
      title: "Schedule",
      description: "Schedule delivery",
      icon: CalendarIcon,
    },
    {
      title: "Driver and Vehicle",
      description: "Assign driver and vehicle",
      icon: Truck,
    },
    { title: "Review", description: "Review order", icon: ClipboardCheck },
  ];

  const fieldsByStep: (keyof DeliveryScheduleFormData)[][] = [
    ["order_ids"],
    ["scheduled_date", "scheduled_time"],
    ["delivery_type", "driver_id", "vehicle_id"],
  ];

  async function handleNext() {
    const fields = fieldsByStep[step] ?? [];
    console.log("fields", fields);

    const isValid = await form.trigger([...fields]);

    if (!isValid) {
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function onSubmit(data: DeliveryScheduleFormData) {
    requestWithErrorHandling(
      await request("POST", `/api/deliveries`, data),
      form,
      () => {
        dispatch({
          type: "CLOSE",
        });
      },
    );
  }

  return (
    <>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>
        <div className="border-y py-4">
          <div className="grid grid-cols-4 gap-2">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const completed = index < step;
              const active = index === step;

              return (
                <div key={item.title} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${
                        completed
                          ? "border-primary bg-primary text-primary-foreground"
                          : active
                            ? "border-primary text-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      {completed ? (
                        <Check className="size-4" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </div>

                    <span
                      className={`hidden truncate text-sm font-medium sm:block ${
                        active ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>

                  <div
                    className={`mt-3 h-1 rounded-full ${
                      index <= step ? "bg-primary" : "bg-muted"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Step {step + 1} of {steps.length} · {steps[step].description}
          </p>
        </div>

        {step === 0 && (
          <>
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
                    onClick={() => {
                      setSub({
                        is_open: true,
                        mode: DialogMode.INSERT,
                      });
                    }}
                  >
                    <Plus className="mr-1.5 size-3.5" />
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
                          <TableCell>{formatCurrency(item.total)}</TableCell>
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
                            No item have been added yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {(orderDetailQuery.data || []).length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  This is sequence of order items that will be delivered. You
                  can change the order of the items by clicking the up and down
                  arrows in the Actions column.
                </p>
              )}
            </section>
          </>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-2">
            <Controller
              control={form.control}
              name="scheduled_date"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="scheduledDate">
                    Delivery Date <span className="text-destructive">*</span>
                  </FieldLabel>
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
                          { before: startOfDay(new Date()) },
                          { dayOfWeek: [0] },
                          (date) => {
                            const dateKey = format(date, "yyyy-MM-dd");

                            const day = [
                              {
                                date: "2026-10-16",
                                available_slots: 0,
                              },
                              {
                                date: "2026-10-17",
                                available_slots: 5,
                              },
                            ].find((item) => item.date === dateKey);

                            return day?.available_slots === 0;
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
        )}

        {step === 2 && (
          <>
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
                      placeholder="Select driver..."
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

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          {step < steps.length - 1 && (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 size-4" />
            </Button>
          )}
          {step === steps.length - 1 && (
            <>
              <Button type="submit" onClick={form.handleSubmit(onSubmit)}>
                Submit
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </>
  );
}
