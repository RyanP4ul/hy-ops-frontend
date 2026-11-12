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
  ShoppingBag,
  Plus,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { request, requestWithErrorHandling } from "@/components/http";
import Form from "./form";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { OrderDetail, OrderForm, OrderItemDetail } from "@/schema/order";
import { formatCurrency } from "@/utils/date-util";
import Invoice from "./invoice";
import OrderItemDialog from "./item-dialog";
import { QueryFeedback } from "@/components/query-feedback";
import { CreateOrderWorkspace, OrderSubmissionStatus } from "./create-order-workspace";
import { orderBatchFormSchema, draftForPaymentMode } from "@/schema/order-batch";

export default function OrderDialog() {
  const { state, dispatch } = useModal();
  const [actionPending, setActionPending] = useState(false);
  const [nextPending, setNextPending] = useState(false);
  const [invoiceActionContainer, setInvoiceActionContainer] = useState<HTMLSpanElement | null>(null);
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
    draftOrders,
    activeDraftIndex,
    orderCount,
    addAnotherOrder,
    paymentMode,
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

  const steps = [{ title: "Customer & address" }, { title: "Order items" }, { title: "Payment" }, { title: "Review & create" }];
  const creating = state.mode === DialogMode.INSERT;

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
    ["payment_arrangement", "payment_method", "payment_type", "amount_paid"],
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
          const otherQuantity = draftOrders.reduce((sum, draft, index) => index === activeDraftIndex ? sum :
            sum + draft.data.items.filter(other => other.inventory_id === item.inventory_id).reduce((quantity, other) => quantity + other.quantity, 0), 0);
          const available = stock.find(
            (row) => row.inventory_id === item.inventory_id,
          );
          if (!available || item.quantity + otherQuantity > available.quantity) {
            form.setError("root", {
              message: `Stock changed for ${item.product_variant_sku}. Adjust the quantity before continuing; stock is shared across all orders in this submission.`,
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
      if (step === 2 && paymentMode === "SEPARATE") {
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
      <DialogContent className={creating ? "grid max-h-none max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 transition-none sm:max-w-none" : getModalSize()}
        style={creating ? { width: "min(1180px, calc(100vw - 2rem))", maxWidth: "calc(100vw - 2rem)", height: "min(900px, calc(100dvh - 2rem))", maxHeight: "calc(100dvh - 2rem)" } : undefined}>
        <DialogHeader className={creating ? "flex-row items-center gap-3 border-b px-4 py-5 pr-12 sm:px-7 sm:pr-12" : undefined}>
          {creating && <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background"><ShoppingBag className="size-5" aria-hidden="true" /></div>}
          <div className="min-w-0 flex-1">
            <DialogTitle className={creating ? "text-xl font-semibold tracking-tight" : undefined}>{state.title}</DialogTitle>
            <DialogDescription className={creating ? "mt-1.5 text-xs sm:text-sm" : undefined}>{creating ? "Prepare one order or several destinations for the same customer." : state.description}</DialogDescription>
          </div>
          {creating && <span className="hidden shrink-0 rounded-lg border bg-muted/30 px-3 py-2 text-xs font-medium sm:inline-flex">{orderCount} {orderCount === 1 ? "order" : "orders"}</span>}
        </DialogHeader>

        {!creating && form.formState.errors.root && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
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
          <CreateOrderWorkspace disabled={nextPending || form.formState.isSubmitting} error={form.formState.errors.root?.message}>
            <Form key={`${activeDraftIndex}:${orderCount}`} />
          </CreateOrderWorkspace>
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
          <Invoice orderId={selected.id} actionContainer={invoiceActionContainer} />
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

        <DialogFooter className={creating ? "mx-0 mb-0 flex-row flex-wrap items-center gap-2 rounded-none border-t bg-background px-4 py-4 sm:px-7" : ""}>
          {state.mode === DialogMode.INSERT ? (
            <>
              <OrderSubmissionStatus />
              <Button
                type="button"
                variant="outline"
                className="min-h-10 flex-1 sm:flex-none"
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
                  className="h-auto min-h-10 min-w-0 flex-1 whitespace-normal py-2 text-left sm:flex-none"
                  onClick={handleNext}
                  disabled={
                    nextPending
                  }
                >
                  {nextPending ? "Checking details..." : `Continue to ${steps[step + 1].title.toLowerCase()}`}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              )}

              {step === steps.length - 1 && (
                <Button type="button" variant="outline" className="h-auto min-h-10 flex-1 whitespace-normal py-2 sm:flex-none" disabled={form.formState.isSubmitting || nextPending || orderCount >= 25} onClick={() => {
                  const result = orderBatchFormSchema.safeParse({ customer_id: form.getValues("customer_id"), orders: [draftForPaymentMode(form.getValues(), paymentMode)] });
                  if (!result.success) {
                    form.setError("root", { message: result.error.issues[0]?.message ?? "Complete this order before adding another." });
                    return;
                  }
                  addAnotherOrder();
                }}><Plus className="size-4 shrink-0" aria-hidden="true" />Add another order</Button>
              )}
              {step === steps.length - 1 && (
                <Button
                  variant={"default"}
                  className="h-auto min-h-10 flex-1 whitespace-normal py-2 sm:flex-none"
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
                  {form.formState.isSubmitting ? (orderCount > 1 ? `Creating ${orderCount} orders...` : "Creating order...") : (orderCount > 1 ? `Create all ${orderCount} orders` : "Create order")}
                </Button>
              )}
            </>
          ) : state.mode === DialogMode.VIEW || state.title === "Invoice" ? (
            <>
              <DialogClose
                render={
                  <Button type="button" variant="outline">
                    Close
                  </Button>
                }
              />
              {state.title === "Invoice" && <span ref={setInvoiceActionContainer} className="contents" />}
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
          {order.payment_type && <ViewOrderItem label="Payment Type" value={order.payment_type} />}
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
