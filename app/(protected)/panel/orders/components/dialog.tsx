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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useOrders } from "../provider";
import {
  Loader2,
  Eye,
  Truck,
  Package,
  Pencil,
  Trash2,
  Plus,
  CreditCard,
  ClipboardCheck,
  Check,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { request, requestWithErrorHandling } from "@/components/http";
import { useWebSocket } from "@/components/providers/websocket-provider";
import Form from "./form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { OrderForm, OrderItemDetail } from "@/schema/order";
import { toast } from "sonner";

export default function OrderDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const { form, step, setStep, ordersQuery, orderViewQuery, selected } =
    useOrders();

  const steps = [
    {
      title: "Customer Details",
      description: "Customer details",
      icon: Package,
    },
    {
      title: "Order Items",
      description: "Add and manage order items",
      icon: ClipboardCheck,
    },
    {
      title: "Payment",
      description: "Add and manage payment information",
      icon: CreditCard,
    },
    { title: "Review", description: "Review order", icon: ClipboardCheck },
  ];

  const fieldsByStep: (keyof (OrderForm & { items: OrderItemDetail[] }))[][] = [
    [
      "customer_id",
      "notes",
      "is_custom_shipping",
      "shipping_recipient",
      "shipping_phone",
      "shipping_address",
    ],
    ["items"],
    ["payment_arrangement", "payment_method", "amount_paid"],
  ];

  async function onProcessOrder() {
    requestWithErrorHandling(
      await request(
        "POST",
        `/api/orders/process/${selected.id}?version=${selected.version}`,
      ),
      form,
      () => {
        ordersQuery.refetch();

        dispatch({
          type: "CLOSE",
        });
      },
    );
  }

  async function onDeliveryOrder() {
    requestWithErrorHandling(
      await request(
        "POST",
        `/api/orders/delivery/${selected.id}?version=${selected.version}`,
      ),
      form,
      () => {
        ordersQuery.refetch();

        dispatch({
          type: "CLOSE",
        });
      },
    );
  }

  async function handleNext() {
    const fields = fieldsByStep[step] ?? [];
    console.log("fields", fields);

    const isValid = await form.trigger([...fields]);

    if (!isValid) {
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

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
        ) : [DialogMode.EDIT, DialogMode.INSERT].includes(state.mode) &&
          state.isOpen ? (
          <>
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
            <Form />
          </>
        ) : state.mode === DialogMode.CUSTOM &&
          state.title === "Process Order" &&
          state.isOpen ? (
          <>
            <form
              id="form"
              onSubmit={(event) => {
                event.preventDefault();

                onProcessOrder();
              }}
            >
              <div className="space-y-5">
                <section className="space-y-3">
                  <h4 className="text-sm font-medium">Order Information</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Order Number
                      </p>
                      <p className="break-words text-sm font-medium">
                        ORD-0001
                      </p>
                    </div>
                  </div>
                </section>

                <Separator />

                <p className="text-xs text-muted-foreground">
                  Please review the order details before proceeding with the
                  processing. Ensure that all information is accurate and
                  complete.
                </p>
              </div>
            </form>
          </>
        ) : state.mode === DialogMode.CUSTOM &&
          state.title === "Ready for Delivery" &&
          state.isOpen ? (
          <form
            id="form"
            onSubmit={(event) => {
              event.preventDefault();

              onDeliveryOrder();
            }}
          ></form>
        ) : (
          [DialogMode.CANCEL].includes(state.mode) &&
          state.isOpen && (
            <>
              {/* <form
                id="form"
                onSubmit={(event) => {
                  event.preventDefault();

                  if (state.mode === DialogMode.DELETE) {
                    onDelete();
                  } else {
                    onArchive();
                  }
                }}
              ></form> */}
            </>
          )
        )}

        <DialogFooter>
          {state.mode === DialogMode.INSERT ? (
            <>
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
                <Button
                  variant={"default"}
                  disabled={!state.isOpen}
                  type="submit"
                  form="form"
                >
                  {state.action}
                </Button>
              )}
            </>
          ) : (
            <>
              <DialogClose
                render={
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                }
              />

              <Button
                variant={
                  state.mode === DialogMode.DELETE ||
                  state.mode === DialogMode.ARCHIVE
                    ? "destructive"
                    : "default"
                }
                disabled={!state.isOpen}
                type="submit"
                form="form"
              >
                {state.action}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </>
  );
}
