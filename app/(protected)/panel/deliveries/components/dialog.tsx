"use client";

import { Button } from "@/components/ui/button";
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
import { Controller, useForm } from "react-hook-form";
import {
  DeliveriesEventForm,
  DeliveriesEventFormType,
} from "@/schema/deliveries";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { format, startOfDay } from "date-fns";
import { request, requestWithErrorHandling } from "@/components/http";

export default function DeliveriesDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const { deliveriesQuery, event_form } = useDeliveries();

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
    console.log("Submitting form data:", data);
    ToastSubmit(data);

    requestWithErrorHandling(
      await request("POST", `/api/deliveries/event`, data),
      event_form,
      () => {
        deliveriesQuery.refetch();

        dispatch({
          type: "CLOSE",
        });
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

                        <FieldDescription>
                          If you see disabled dates, it means there are no
                          available slots for that date.
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
          </>
        )}
      </DialogContent>
    </>
  );
}
