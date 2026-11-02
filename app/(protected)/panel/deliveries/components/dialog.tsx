"use client";

import { Button } from "@/components/ui/button";
import { PaginatedCombobox } from "@/components/paginated-combobox";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useDeliveries } from "../provider";
import { ChevronDownIcon, Loader2 } from "lucide-react";
import { useWebSocket } from "@/components/providers/websocket-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Controller } from "react-hook-form";
import {
  DeliveriesEventFormType,
  DeliveriesAssignmentFormType,
} from "@/schema/deliveries";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ToastSubmit, ToastValidationError } from "@/components/util";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { manilaCalendarNow } from "@/utils/date-util";
import { format, startOfDay } from "date-fns";
import { request, requestWithErrorHandling } from "@/components/http";
import { REQUESTS } from "@/constant/request";

export default function DeliveriesDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const {
    deliveriesQuery,
    event_form,
    assignment_form,
    driversQuery,
    vehiclesQuery,
    driverCB,
    vehicleCB,
  } = useDeliveries();

  const event_type = event_form.watch("event_type");
  const reason = event_form.watch("reason");

  // async function onDeliveryOrder() {
  //   requestWithErrorHandling(
  //     await request(
  //       "POST",
  //       `/api/orders/delivery/${selected.id}?version=${selected.version}`,
  //     ),
  //     form,
  //     () => {
  //       ordersQuery.refetch();

  //       dispatch({
  //         type: "CLOSE",
  //       });
  //     },
  //   );
  // }

  const getModalSize = () => {
    switch (state.mode) {
      case DialogMode.DELETE:
        return "sm:max-w-md";
      case DialogMode.VIEW:
        return "sm:max-w-3xl";
      case DialogMode.CANCEL:
      case DialogMode.CUSTOM:
        return "sm:max-w-xl";
      default:
        return "sm:max-w-5xl";
    }
  };

  async function handleSubmit(data: DeliveriesEventFormType) {
    ToastSubmit(data);

    await requestWithErrorHandling(
      await request("POST", `/api/deliveries/event`, { ...data, scheduled_date: data.scheduled_date ? format(data.scheduled_date, "yyyy-MM-dd") : undefined }),
      event_form,
      (result) => {
        deliveriesQuery.refetch();
        if (result.delivery) {
          send({
            type: REQUESTS.DELIVERY_UPDATED,
            payload: [JSON.stringify(result.delivery)],
          });
        }

        dispatch({
          type: "CLOSE",
        });
      },
    );
  }

  async function handleAssignmentSubmit(data: DeliveriesAssignmentFormType) {
    ToastSubmit(data);

    await requestWithErrorHandling(
      await request("PATCH", `/api/deliveries/${data.delivery_id}/assignment`, {
        driver_id: data.driver_id,
        vehicle_id: data.vehicle_id,
        delivery_version: data.delivery_version,
      }),
      assignment_form,
      (result) => {
        deliveriesQuery.refetch();
        if (result.delivery) {
          send({
            type: REQUESTS.DELIVERY_UPDATED,
            payload: [JSON.stringify(result.delivery)],
          });
        }
        dispatch({ type: "CLOSE" });
      },
    );
  }

  return (
    <>
      <DialogContent className={getModalSize()}>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>

        {!state.isOpen ? (
          <Loader2
            className="mx-auto size-6 animate-spin"
            aria-label="Loading"
          />
        ) : (
          <>
            {state.mode === DialogMode.CHANGE_ASSIGNMENT ? (
              <form
                onSubmit={assignment_form.handleSubmit(
                  handleAssignmentSubmit,
                  (error) => ToastValidationError(error),
                )}
                className="space-y-5"
              >
                <Controller
                  control={assignment_form.control}
                  name="driver_id"
                  render={({ field, fieldState }) => (
                    <PaginatedCombobox
                      id={field.name}
                      label="Driver"
                      required
                      value={field.value > 0 ? String(field.value) : null}
                      selectedLabel={field.value > 0 ? driverCB.inputValue : ""}
                      options={driversQuery.data?.rows ?? []}
                      getOptionValue={(driver) => String(driver.id)}
                      renderOption={(driver) => `${driver.name} · Available`}
                      onValueChange={(value, driver) => {
                        field.onChange(value ? Number(value) : -1);
                        driverCB.setInputValue(driver?.name ?? "");
                      }}
                      onSearchChange={driverCB.setSearchQuery}
                      page={driverCB.page}
                      totalPages={Math.ceil((driversQuery.data?.total ?? 0) / 10)}
                      onPageChange={driverCB.setPage}
                      isLoading={driversQuery.isFetching}
                      disabled={assignment_form.formState.isSubmitting}
                      placeholder="Search drivers..."
                      emptyMessage={driversQuery.isError ? "Unable to load drivers. Please try again." : "No drivers found."}
                      invalid={fieldState.invalid}
                      error={fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    />
                  )}
                />

                <Controller
                  control={assignment_form.control}
                  name="vehicle_id"
                  render={({ field, fieldState }) => (
                    <PaginatedCombobox
                      id={field.name}
                      label="Vehicle"
                      required
                      value={field.value > 0 ? String(field.value) : null}
                      selectedLabel={field.value > 0 ? vehicleCB.inputValue : ""}
                      options={vehiclesQuery.data?.rows ?? []}
                      getOptionValue={(vehicle) => String(vehicle.id)}
                      renderOption={(vehicle) => `${vehicle.plate_number} (${vehicle.type})`}
                      onValueChange={(value, vehicle) => {
                        field.onChange(value ? Number(value) : -1);
                        vehicleCB.setInputValue(vehicle ? `${vehicle.plate_number} (${vehicle.type})` : "");
                      }}
                      onSearchChange={vehicleCB.setSearchQuery}
                      page={vehicleCB.page}
                      totalPages={Math.ceil((vehiclesQuery.data?.total ?? 0) / 10)}
                      onPageChange={vehicleCB.setPage}
                      isLoading={vehiclesQuery.isFetching}
                      disabled={assignment_form.formState.isSubmitting}
                      placeholder="Search vehicles..."
                      emptyMessage={vehiclesQuery.isError ? "Unable to load vehicles. Please try again." : "No vehicles found."}
                      invalid={fieldState.invalid}
                      error={fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    />
                  )}
                />

                {(event_form.formState.errors.root?.message || assignment_form.formState.errors.root?.message) && <p role="alert" className="text-sm text-destructive">{event_form.formState.errors.root?.message ?? assignment_form.formState.errors.root?.message}</p>}
              <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={assignment_form.formState.isSubmitting}
                    onClick={() => dispatch({ type: "CLOSE" })}
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    disabled={assignment_form.formState.isSubmitting}
                  >
                    {assignment_form.formState.isSubmitting && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            ) : (
            <form
              onSubmit={event_form.handleSubmit(handleSubmit, (error) => {
                ToastValidationError(error);
              })}
              className="space-y-5"
            >
              <Controller
                control={event_form.control}
                name="event_type"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Event Type</FieldLabel>

                    <Select
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={event_form.formState.isSubmitting}
                    >
                      <SelectTrigger
                        id={field.name}
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="CANCELLED">Cancel</SelectItem>
                        <SelectItem value="RESCHEDULED">Reschedule</SelectItem>
                      </SelectContent>
                    </Select>

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {event_type === "RESCHEDULED" && (
                <div className="grid grid-cols-2 gap-2">
                  <Controller
                    control={event_form.control}
                    name="scheduled_date"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="scheduledDate">
                          Delivery Date{" "}
                          <span className="text-destructive">*</span>
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
                              disabled={{ before: startOfDay(manilaCalendarNow()) }}
                            />
                          </PopoverContent>
                        </Popover>

                        <FieldDescription>
                          Choose a future departure in Asia/Manila.
                        </FieldDescription>

                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    control={event_form.control}
                    name="departure_time"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="departure_time">
                          Departure Time{" "}
                          <span className="text-destructive">*</span>
                        </FieldLabel>

                        <Input
                          {...field}
                          id={field.name}
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

              <Controller
                control={event_form.control}
                name="reason"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Reason</FieldLabel>

                    <Textarea
                      {...field}
                      id={field.name}
                      placeholder={
                        event_type === "CANCELLED"
                          ? "Why is this delivery being cancelled?"
                          : "Why does this delivery need to be rescheduled?"
                      }
                      rows={4}
                      maxLength={255}
                      disabled={event_form.formState.isSubmitting}
                      aria-invalid={fieldState.invalid}
                    />

                    <FieldDescription className="text-right">
                      {reason?.length || 0}/255 characters
                    </FieldDescription>

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {(event_form.formState.errors.root?.message || assignment_form.formState.errors.root?.message) && <p role="alert" className="text-sm text-destructive">{event_form.formState.errors.root?.message ?? assignment_form.formState.errors.root?.message}</p>}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={event_form.formState.isSubmitting}
                  onClick={() => {
                    dispatch({
                      type: "CLOSE",
                    });
                  }}
                >
                  Close
                </Button>

                <Button
                  type="submit"
                  variant={
                    event_type === "CANCELLED" ? "destructive" : "default"
                  }
                  disabled={event_form.formState.isSubmitting}
                >
                  {event_form.formState.isSubmitting && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}

                  {event_type === "CANCELLED"
                    ? "Cancel Delivery"
                    : "Reschedule Delivery"}
                </Button>
              </DialogFooter>
            </form>
            )}
          </>
        )}
      </DialogContent>
    </>
  );
}
