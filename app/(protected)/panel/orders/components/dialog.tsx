"use client";

import { ViewOrderDetails, ViewOrderItem } from "@/components/order-details";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { OrderDetail, OrderForm, OrderItemDetail } from "@/schema/order";
import { toast } from "sonner";
import { REQUESTS } from "@/constant/request";
import { formatCurrency } from "@/utils/date-util";
import Invoice from "./invoice";
import OrderItemDialog from "./item-dialog";
import { QueryFeedback } from "@/components/query-feedback";
import { WorkflowStepper, WorkflowSummary, type WorkflowStep } from "@/components/workflow-stepper";

export default function OrderDialog() {
  const { state, dispatch } = useModal();
  const { send } = useWebSocket();
  const [actionPending, setActionPending] = useState(false);
  const [nextPending, setNextPending] = useState(false);
  const initializedEdit = useRef<object | null>(null);
  const {
    form,
    step,
    setStep,
    setPage,
    ordersQuery,
    orderDetailQuery,
    orderViewQuery,
    selected,
    customerOrderEligibility,
    warehouseCB,
    customerCB,
  } = useOrders();

  useEffect(() => {
    if (!state.isOpen) {
      initializedEdit.current = null;
      form.clearErrors();
      return;
    }
    if (
      state.mode === DialogMode.EDIT &&
      !orderDetailQuery.isFetching &&
      orderDetailQuery.data?.id === selected.id &&
      initializedEdit.current !== state
    ) {
      form.resetField("notes", {
        defaultValue: orderDetailQuery.data.notes ?? "",
      });
      initializedEdit.current = state;
    }
  }, [
    state,
    selected.id,
    orderDetailQuery.data,
    orderDetailQuery.isFetching,
    form,
  ]);

  const steps: WorkflowStep[] = [
    { title: "Customer & address", description: "Choose the warehouse, customer and delivery address for this order.", icon: Package,
      details: ["Start with the warehouse that will supply the stock.", "Choose a saved customer address or enter a custom recipient and destination."] },
    { title: "Order items", description: "Add products and confirm the quantities the customer needs.", icon: ClipboardCheck,
      details: ["Check each product variant, quantity and unit price.", "Stock and current prices are checked again when you continue."] },
    { title: "Payment", description: "Record the payment arrangement, method and amount received.", icon: CreditCard,
      details: ["Use the amount actually received, not the outstanding balance.", "The paid amount must match the selected payment arrangement."] },
    { title: "Review & create", description: "Check the complete order before creating it.", icon: ClipboardCheck,
      details: ["Return to an earlier step if the customer, address, items or payment needs changing.", "The order is submitted only when you select Create order."] },
  ];
  const draftItems = form.watch("items") ?? [];
  const draftWarehouse = form.watch("warehouse_id");
  const draftCustomer = form.watch("customer_id");
  const draftPricesKnown = draftItems.every(item => typeof item.price === "number" && Number.isFinite(item.price));
  const draftTotal = draftItems.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);

  const fieldsByStep: (keyof (OrderForm & { items: OrderItemDetail[] }))[][] = [
    [
      "warehouse_id",
      "customer_id",
      "notes",
      "is_custom_shipping",
      "shipping_recipient",
      "shipping_phone",
      "shipping_address",
      "shipping_latitude",
      "shipping_longitude",
      "customer_address_id",
    ],
    ["items"],
    ["payment_arrangement", "payment_method", "amount_paid"],
  ];

  async function performAction(path: string, data?: object, method = "POST") {
    if (actionPending) return;
    setActionPending(true);
    form.clearErrors("root");
    try {
      await requestWithErrorHandling(
        await request(method, path, data),
        form,
        () => {
          setPage((current) => ({ ...current, pageIndex: 0 }));
          void ordersQuery.refetch();
          dispatch({ type: "CLOSE" });
        },
      );
    } finally {
      setActionPending(false);
    }
  }
  const onProcessOrder = () =>
    performAction(
      `/api/orders/process/${selected.id}?version=${selected.version}`,
    );
  const onDeliveryOrder = () =>
    performAction(
      `/api/orders/delivery/${selected.id}?version=${selected.version}`,
    );

  async function handleNext() {
    if (nextPending) return;
    setNextPending(true);
    try {
      const fields = fieldsByStep[step] ?? [];

      const isValid = await form.trigger([...fields], { shouldFocus: true });

      if (!isValid) {
        return;
      }

      if (state.mode === DialogMode.INSERT && step === 0) {
        const customerId = form.getValues("customer_id");
        if (customerId > 0) {
          const eligibility = await customerOrderEligibility.refetch();
          if (eligibility.isError || !eligibility.data) return;
          if (!eligibility.data.eligible) {
            toast.error(
              eligibility.data.message ??
                "This customer has reached the active order limit.",
            );
            return;
          }
        }
      }

      if (step === 1) {
        const items = form.getValues("items");
        const response = await request(
          "GET",
          `/api/inventory/details?ids=${items.map((item) => item.inventory_id).join(",")}`,
        );
        if (!response.ok) {
          form.setError("root", {
            message: "Unable to verify stock. Try again before continuing.",
          });
          return;
        }
        const stock = (await response.json()) as {
          inventory_id: number;
          quantity: number;
          price: string;
        }[];
        for (const item of items) {
          const available = stock.find(
            (row) => row.inventory_id === item.inventory_id,
          );
          if (!available || item.quantity > available.quantity) {
            form.setError("root", {
              message: `Stock changed for ${item.product_variant_sku}. Adjust the quantity before continuing.`,
            });
            return;
          }
        }
        form.setValue(
          "items",
          items.map((item) => ({
            ...item,
            price: Number(
              stock.find((row) => row.inventory_id === item.inventory_id)!
                .price,
            ),
          })),
        );
      }
      if (step === 2) {
        const total = Math.round(
          form
            .getValues("items")
            .reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0) *
            100,
        );
        const paid = Math.round(form.getValues("amount_paid") * 100),
          arrangement = form.getValues("payment_arrangement");
        if (
          paid > total ||
          (arrangement === "FULLY_PAID" && paid !== total) ||
          (arrangement === "PARTIALLY_PAID" && (paid <= 0 || paid >= total))
        ) {
          form.setError("amount_paid", {
            message:
              "Amount must match the payment arrangement and stay within the order total.",
          });
          return;
        }
      }
      form.clearErrors("root");
      setStep((current) => Math.min(current + 1, steps.length - 1));
    } finally {
      setNextPending(false);
    }
  }

  const getModalSize = () => {
    switch (state.mode) {
      case DialogMode.DELETE:
        return "sm:max-w-md";
      case DialogMode.VIEW:
        return "sm:max-w-3xl";
      case DialogMode.CANCEL:
      case DialogMode.CUSTOM:
        return state.title === "Invoice" ? "sm:max-w-3xl" : "sm:max-w-xl";
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

        {form.formState.errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}
        {state.mode === DialogMode.VIEW && (
          <QueryFeedback query={orderViewQuery} label="order details" />
        )}
        {state.mode !== DialogMode.INSERT &&
          state.mode !== DialogMode.VIEW &&
          state.title !== "Invoice" && (
            <QueryFeedback query={orderDetailQuery} label="order details" />
          )}
        {state.mode === DialogMode.EDIT && state.isOpen ? (
          <form
            id="form"
            onSubmit={(event) => {
              event.preventDefault();
              void performAction(
                `/api/orders/${selected.id}`,
                {
                  notes: form.getValues("notes") ?? "",
                  version: selected.version,
                },
                "PUT",
              );
            }}
          >
            <Label htmlFor="order-notes">Order notes</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Prices, items and shipping snapshots are preserved. Cancel and
              create a new order to change these details.
            </p>
            <Textarea
              id="order-notes"
              disabled={orderDetailQuery.isFetching || !orderDetailQuery.data}
              maxLength={2000}
              {...form.register("notes")}
            />
          </form>
        ) : !state.isOpen ? (
          <Loader2
            className="mx-auto size-6 animate-spin"
            aria-label="Loading"
          />
        ) : [DialogMode.INSERT].includes(state.mode) && state.isOpen ? (
          <>
            <WorkflowStepper label="Order creation progress" steps={steps} current={step}
              disabled={nextPending || form.formState.isSubmitting}
              onBackToStep={setStep}
              summary={<WorkflowSummary items={[
                { label: "Warehouse", value: warehouseCB.inputValue || (draftWarehouse > 0 ? `Warehouse #${draftWarehouse}` : "Choose a warehouse") },
                { label: "Customer", value: customerCB.inputValue || (draftCustomer > 0 ? `Customer #${draftCustomer}` : "Choose a customer") },
                { label: "Items", value: `${draftItems.length} ${draftItems.length === 1 ? "line item" : "line items"}` },
                { label: "Order total", value: draftItems.length ? (draftPricesKnown ? formatCurrency(draftTotal) : "Prices not confirmed") : "Add items to calculate" },
              ]} />}
            />
            <Form />
          </>
        ) : state.mode === DialogMode.VIEW && state.isOpen ? (
          <ViewOrderDetails
            order={orderViewQuery.data || null}
            isLoading={orderViewQuery.isLoading}
          />
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
              <OrderActionDetails
                order={orderDetailQuery.data || null}
                isLoading={orderDetailQuery.isLoading}
                action="process"
              />
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
          >
            <OrderActionDetails
              order={orderDetailQuery.data || null}
              isLoading={orderDetailQuery.isLoading}
              action="delivery"
            />
          </form>
        ) : state.mode === DialogMode.CUSTOM &&
          state.title === "Invoice" &&
          state.isOpen ? (
          <Invoice orderId={selected.id} />
        ) : (
          [DialogMode.CANCEL].includes(state.mode) &&
          state.isOpen && (
            <>
              <form
                id="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void performAction(
                    `/api/orders/cancel/${selected.id}?version=${selected.version}`,
                  );
                }}
              >
                <p className="text-sm">
                  Cancel this order and release its reserved stock? Any received
                  payment remains recorded and can be refunded by an
                  administrator from Payments.
                </p>
              </form>
            </>
          )
        )}

        <DialogFooter className={state.mode === DialogMode.INSERT ? "sticky -bottom-4 z-20 flex-wrap items-center rounded-lg border bg-background/95 p-3 backdrop-blur-sm" : ""}>
          {state.mode === DialogMode.INSERT ? (
            <>
              <p className="w-full text-xs text-muted-foreground sm:mr-auto sm:w-auto">{step === steps.length - 1 ? "Ready to create? Check the details above." : `Step ${step + 1} of ${steps.length} / Changes are not saved yet.`}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((current) => Math.max(current - 1, 0))}
                disabled={
                  step === 0 || nextPending || form.formState.isSubmitting
                }
              >
                <ArrowLeft className="mr-2 size-4" />
                Back
              </Button>

              {step < steps.length - 1 && (
                <Button
                  type="button"
                  className="h-auto min-h-10 min-w-0 whitespace-normal text-left"
                  onClick={handleNext}
                  disabled={
                    nextPending ||
                    (step === 0 &&
                      form.getValues("customer_id") > 0 &&
                      (customerOrderEligibility.isFetching ||
                        customerOrderEligibility.isError ||
                        customerOrderEligibility.data?.eligible === false))
                  }
                >
                  {nextPending ? "Checking details..." : `Continue to ${steps[step + 1].title.toLowerCase()}`}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              )}

              {step === steps.length - 1 && (
                <Button
                  variant={"default"}
                  disabled={
                    !state.isOpen ||
                    form.formState.isSubmitting ||
                    actionPending
                  }
                  type="submit"
                  form="form"
                >
                  {form.formState.isSubmitting && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  {form.formState.isSubmitting ? "Creating order..." : "Create order"}
                </Button>
              )}
            </>
          ) : state.mode === DialogMode.VIEW || state.title === "Invoice" ? (
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Close
                </Button>
              }
            />
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
                disabled={
                  !state.isOpen ||
                  form.formState.isSubmitting ||
                  actionPending ||
                  orderDetailQuery.isFetching ||
                  orderDetailQuery.isError ||
                  !orderDetailQuery.data
                }
                type="submit"
                form="form"
              >
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {state.action}
              </Button>
            </>
          )}
        </DialogFooter>
        <OrderItemDialog />
      </DialogContent>
    </>
  );
}

function OrderActionDetails({
  order,
  isLoading,
  action,
}: {
  order: OrderDetail | null;
  isLoading: boolean;
  action: "process" | "delivery";
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin" aria-label="Loading order" />
      </div>
    );
  }

  if (!order) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Unable to load this order. Please close the dialog and try again.
      </p>
    );
  }

  const total = order.items.some((item) => item.price === null)
    ? null
    : order.items.reduce(
        (sum, item) => sum + (item.price ?? 0) * item.quantity,
        0,
      );
  const formatValue = (value?: string) =>
    value
      ? value
          .toLowerCase()
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ")
      : "Not specified";

  return (
    <div className="max-h-[65vh] space-y-5 overflow-y-auto">
      <section className="space-y-3">
        <h4 className="text-sm font-medium">Order Information</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <ViewOrderItem label="Order Number" value={order.order_number} />
          <ViewOrderItem label="Customer" value={order.customer_name} />
          <ViewOrderItem
            label="Delivery Type"
            value={
              order.delivery_type
                ? formatValue(order.delivery_type)
                : "Assigned when scheduling"
            }
          />
          <ViewOrderItem
            label="Payment Arrangement"
            value={formatValue(order.payment_arrangement)}
          />
          <ViewOrderItem
            label="Payment Method"
            value={formatValue(order.payment_method)}
          />
          <ViewOrderItem
            label="Order Total"
            value={total === null ? "Unverified" : formatCurrency(total)}
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h4 className="text-sm font-medium">Items to Prepare</h4>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.inventory_id}>
                  <TableCell className="font-medium">
                    {item.product_variant_name}
                  </TableCell>
                  <TableCell>{item.product_variant_sku}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {item.price === null
                      ? "Unverified"
                      : formatCurrency(item.price * item.quantity)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {(order.shipping_address || order.notes) && (
        <>
          <Separator />
          <section className="space-y-3">
            <h4 className="text-sm font-medium">Additional Details</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {order.shipping_address && (
                <>
                  <ViewOrderItem
                    label="Shipping Recipient"
                    value={order.shipping_recipient}
                  />
                  <ViewOrderItem
                    label="Shipping Phone"
                    value={order.shipping_phone}
                  />
                  <div className="sm:col-span-2">
                    <ViewOrderItem
                      label="Shipping Address"
                      value={order.shipping_address}
                    />
                  </div>
                </>
              )}
              {order.notes && (
                <div className="sm:col-span-2">
                  <ViewOrderItem label="Notes" value={order.notes} />
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {action === "process"
          ? "Review the order details before starting processing. Confirm that all items and information are available."
          : "Confirm that all items have been checked and prepared before marking this order ready for delivery."}
      </p>
    </div>
  );
}
