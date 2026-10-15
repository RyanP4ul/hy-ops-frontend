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
  Calendar,
  Check,
  ClipboardCheck,
  Truck,
} from "lucide-react";

export default function DeliveryScheduleDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const { step, setStep } = useDeliverySchedule();

  const steps = [
    {
      title: "Order Details",
      description: "View rder details",
      icon: ClipboardCheck,
    },
    {
      title: "Schedule",
      description: "Schedule delivery",
      icon: Calendar,
    },
    {
      title: "Driver and Vehicle",
      description: "Assign driver and vehicle",
      icon: Truck,
    },
    { title: "Review", description: "Review order", icon: ClipboardCheck },
  ];

  async function handleNext() {
    // const fields = fieldsByStep[step] ?? [];
    // console.log("fields", fields);

    // const isValid = await form.trigger([...fields]);

    // if (!isValid) {
    //   return;
    // }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

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
        Content
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
        </DialogFooter>
      </DialogContent>
    </>
  );
}
