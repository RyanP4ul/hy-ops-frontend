"use client";

import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useCalendar } from "../provider";
import { ChevronDownIcon, Loader2 } from "lucide-react";
import { ToastSubmit, ToastValidationError } from "@/components/util";
import { CalendarFormType } from "@/schema/calendar";
import { Controller } from "react-hook-form";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format, startOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { useEffect } from "react";
import { DialogMode } from "@/types/dialog";
import { request, requestWithErrorHandling } from "@/components/http";

export default function CalendarDialog() {
  const { state, dispatch } = useModal();
  const { calendar_form, eventQuery, selected } = useCalendar();

  async function handleSubmit(data: CalendarFormType) {
    ToastSubmit(data);

    requestWithErrorHandling(
      await request("POST", `/api/calendar/event`, data),
      calendar_form,
      () => {
        eventQuery.refetch();

        dispatch({
          type: "CLOSE",
        });
      },
    );
  }

  useEffect(() => {
    if (state.mode === DialogMode.EDIT) {
      console.log("EDIT!");
      const event = eventQuery.data?.find((e) => e.id === selected.id);

      if (event) {
        calendar_form.reset({
          title: event.title,
          category: event.category,
          date: event.date,
          start_time: format(event.start_time, "HH:mm"),
          end_time: format(event.end_time, "HH:mm"),
        });
      }
    } else {
      calendar_form.reset({
        title: "",
        category: "OTHER",
        date: undefined,
        start_time: "07:00",
        end_time: "08:00",
      });
    }
  }, [selected]);

  return (
    <>
      <DialogContent className={"sm:max-w-3xl"}>
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
          <form
            onSubmit={calendar_form.handleSubmit(handleSubmit, (error) => {
              ToastValidationError(error);
            })}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Controller
                control={calendar_form.control}
                name="title"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="title">
                      Title <span className="text-destructive">*</span>
                    </FieldLabel>

                    <Input
                      {...field}
                      id={field.name}
                      type="text"
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter event title"
                      autoComplete="off"
                    />

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                control={calendar_form.control}
                name="category"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Category</FieldLabel>

                    <Select
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={calendar_form.formState.isSubmitting}
                    >
                      <SelectTrigger
                        id={field.name}
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="DELIVERY">Delivery</SelectItem>
                        <SelectItem value="INVENTORY_WAREHOUSE">
                          Inventory/Warehouse
                        </SelectItem>
                        <SelectItem value="VEHICLE_MAINTENANCE">
                          Vehicle Maintenance
                        </SelectItem>
                        <SelectItem value="MEETING_APPOINTMENT">
                          Meeting/Appointment
                        </SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            <Controller
              control={calendar_form.control}
              name="date"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="scheduledDate">
                    Date <span className="text-destructive">*</span>
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
                        disabled={[{ before: startOfDay(new Date()) }]}
                      />
                    </PopoverContent>
                  </Popover>

                  <FieldDescription>
                    If you see disabled dates, it means there are no available
                    slots for that date.
                  </FieldDescription>

                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Controller
                control={calendar_form.control}
                name="start_time"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="start_time">
                      Start Time <span className="text-destructive">*</span>
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

              <Controller
                control={calendar_form.control}
                name="end_time"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="end_time">
                      End Time <span className="text-destructive">*</span>
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={calendar_form.formState.isSubmitting}
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
                disabled={calendar_form.formState.isSubmitting}
              >
                {calendar_form.formState.isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Submit
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </>
  );
}
