"use client";

import {
  formatOrderLabel,
  getOrderPaymentSummary,
  getOrderStatusBadgeClass,
} from "@/components/order-details";
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
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useOrders } from "../provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Layers,
  Link2,
  Plus,
  ArrowLeft,
  ArrowRight,
  Unlink,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { request, requestWithErrorHandling } from "@/components/http";
import { refreshRealtimeQueries } from "@/lib/realtime";
import Form from "./form";
import { useEffect, useState } from "react";
import {
  GroupCandidatesResponse,
  OrderDetail,
  OrderForm,
  OrderItemDetail,
  OrderTableRow,
  formatOrderGroupCode,
} from "@/schema/order";
import { formatCurrency } from "@/utils/date-util";
import Invoice from "./invoice";
import OrderItemDialog from "./item-dialog";
import { QueryFeedback } from "@/components/query-feedback";
import { CreateOrderWorkspace, OrderSubmissionStatus } from "./create-order-workspace";
import { EditOrderForm, type EditOrderPayload } from "./edit-order-form";
import { orderBatchFormSchema, draftForPaymentMode } from "@/schema/order-batch";

export default function OrderDialog() {
  const queryClient = useQueryClient();
  const { state, dispatch } = useModal();
  const [actionPending, setActionPending] = useState(false);
  const [nextPending, setNextPending] = useState(false);
  const [invoiceActionContainer, setInvoiceActionContainer] = useState<HTMLSpanElement | null>(null);
  const {
    form,
    step,
    setStep,
    setPage,
    ordersQuery,
    orderDetailQuery,
    selected,
    selectedGroup,
    draftOrders,
    activeDraftIndex,
    orderCount,
    addAnotherOrder,
    paymentMode,
  } = useOrders();

  useEffect(() => {
    if (!state.isOpen) {
      form.clearErrors();
    }
  }, [state.isOpen, form]);

  const steps = [{ title: "Customer & address" }, { title: "Order items" }, { title: "Payment" }, { title: "Review & create" }];
  const creating = state.mode === DialogMode.INSERT;
  const editing = state.mode === DialogMode.EDIT;
  const workspaceLayout = creating || editing;
  const matchedOrderDetail =
    orderDetailQuery.data?.id === selected.id ? orderDetailQuery.data : null;

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
          if (selected.id > 0) {
            void orderDetailQuery.refetch();
          }
          void refreshRealtimeQueries(queryClient, {
            type: "RESOURCE_CHANGED",
            payload: { resource: "orders" },
          });
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
  const onProcessOrderGroup = () => {
    if (!selectedGroup?.order_group_id) return;
    void performAction(`/api/orders/groups/${selectedGroup.order_group_id}/process`);
  };
  const onDeliveryOrderGroup = () => {
    if (!selectedGroup?.order_group_id) return;
    void performAction(`/api/orders/groups/${selectedGroup.order_group_id}/delivery`);
  };
  const onSeparateOrder = () => {
    if (selected.id <= 0) return;
    const version = matchedOrderDetail?.version ?? selected.version;
    void performAction(`/api/orders/${selected.id}/separate`, { version });
  };
  const isSeparatingOrder =
    state.mode === DialogMode.CUSTOM &&
    state.title === "Separate Order from Group";
  const isAddingToGroup =
    state.mode === DialogMode.CUSTOM &&
    state.title === "Add Orders to Group";
  const isGroupAction =
    state.mode === DialogMode.CUSTOM &&
    (state.title === "Process Order Group" ||
      state.title === "Ready Group for Scheduling" ||
      isAddingToGroup);

  const candidateScope = `${selectedGroup?.order_group_id ?? ""}:${isAddingToGroup && state.isOpen}`;
  const [candidateSelection, setCandidateSelection] = useState<{
    scope: string;
    ids: number[];
  }>({ scope: candidateScope, ids: [] });
  const selectedCandidateIds =
    candidateSelection.scope === candidateScope ? candidateSelection.ids : [];

  const groupCandidatesQuery = useQuery({
    queryKey: ["order_group_candidates", selectedGroup?.order_group_id],
    queryFn: async () => {
      if (!selectedGroup?.order_group_id) return null;
      const response = await request(
        "GET",
        `/api/orders/groups/${selectedGroup.order_group_id}/candidates`,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          typeof body?.message === "string" && body.message
            ? body.message
            : "Unable to load eligible orders for this group.",
        );
      }
      return (await response.json()) as GroupCandidatesResponse;
    },
    enabled: isAddingToGroup && state.isOpen && Boolean(selectedGroup?.order_group_id),
  });

  const toggleCandidate = (orderId: number, checked: boolean, maxSelectable: number) => {
    setCandidateSelection((current) => {
      const base = current.scope === candidateScope ? current.ids : [];
      if (!checked) {
        return {
          scope: candidateScope,
          ids: base.filter((id) => id !== orderId),
        };
      }
      if (base.includes(orderId) || base.length >= maxSelectable) {
        return { scope: candidateScope, ids: base };
      }
      return { scope: candidateScope, ids: [...base, orderId] };
    });
  };

  const onAddOrdersToGroup = () => {
    const groupId = selectedGroup?.order_group_id;
    const candidates = groupCandidatesQuery.data?.candidates ?? [];
    if (!groupId || selectedCandidateIds.length === 0) return;
    const payloadOrders = candidates
      .filter((candidate) => selectedCandidateIds.includes(candidate.id))
      .map((candidate) => ({ id: candidate.id, version: candidate.version }));
    if (payloadOrders.length === 0) return;
    void performAction("/api/orders/groups", {
      target_group_id: groupId,
      orders: payloadOrders,
    });
  };

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
      case DialogMode.CANCEL:
        return "sm:max-w-lg";
      case DialogMode.CUSTOM:
        if (state.title === "Invoice") return "sm:max-w-3xl";
        return "sm:max-w-2xl";
      default:
        return "sm:max-w-5xl";
    }
  };

  return (
    <>
      <DialogContent
        className={
          workspaceLayout
            ? "grid max-h-none max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden overscroll-contain rounded-2xl p-0 transition-none sm:max-w-none"
            : getModalSize()
        }
        style={
          creating
            ? {
                width: "min(1140px, calc(100vw - 2rem))",
                maxWidth: "calc(100vw - 2rem)",
                height: "min(860px, calc(100dvh - 2rem))",
                maxHeight: "calc(100dvh - 2rem)",
              }
            : editing
              ? {
                  width: "min(960px, calc(100vw - 2rem))",
                  maxWidth: "calc(100vw - 2rem)",
                  maxHeight: "calc(100dvh - 2rem)",
                }
              : undefined
        }
      >
        <DialogHeader
          className={
            workspaceLayout
              ? "flex-row items-center justify-between gap-3 border-b px-5 py-4 pr-12 sm:px-6 sm:pr-12"
              : undefined
          }
        >
          <div className="min-w-0 flex-1">
            <DialogTitle
              className={
                workspaceLayout
                  ? "text-lg font-semibold tracking-tight"
                  : undefined
              }
            >
              {editing && matchedOrderDetail
                ? `Edit ${matchedOrderDetail.order_number}`
                : state.title}
            </DialogTitle>
            <DialogDescription className={creating ? "sr-only" : undefined}>
              {creating
                ? "Create one or more orders for a customer."
                : editing
                  ? "Update items, delivery method, shipping destination, or order notes before scheduling."
                  : state.description}
            </DialogDescription>
          </div>
        </DialogHeader>

        {!workspaceLayout && form.formState.errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}
        {state.mode !== DialogMode.INSERT &&
          state.mode !== DialogMode.EDIT &&
          state.mode !== DialogMode.VIEW &&
          state.title !== "Invoice" &&
          !isGroupAction && (
            <QueryFeedback query={orderDetailQuery} label="order details" />
          )}
        {state.mode === DialogMode.EDIT && state.isOpen ? (
          <EditOrderForm
            key={selected.id}
            order={matchedOrderDetail}
            isLoading={orderDetailQuery.isPending}
            isFetching={orderDetailQuery.isFetching}
            isError={orderDetailQuery.isError}
            version={selected.version}
            submitting={actionPending}
            serverError={form.formState.errors.root?.message}
            onClearServerError={() => form.clearErrors("root")}
            onSubmit={async (payload: EditOrderPayload) => {
              await performAction(`/api/orders/${selected.id}`, payload, "PUT");
            }}
          />
        ) : !state.isOpen ? (
          <Loader2
            className="mx-auto size-6 animate-spin"
            aria-label="Loading"
          />
        ) : [DialogMode.INSERT].includes(state.mode) && state.isOpen ? (
          <CreateOrderWorkspace disabled={nextPending || form.formState.isSubmitting} error={form.formState.errors.root?.message}>
            <Form key={`${activeDraftIndex}:${orderCount}`} />
          </CreateOrderWorkspace>
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
          state.title === "Ready for Scheduling" &&
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
          state.title === "Process Order Group" &&
          state.isOpen ? (
          <form
            id="form"
            onSubmit={(event) => {
              event.preventDefault();
              onProcessOrderGroup();
            }}
          >
            <OrderGroupActionDetails
              group={selectedGroup}
              action="process"
            />
          </form>
        ) : state.mode === DialogMode.CUSTOM &&
          state.title === "Ready Group for Scheduling" &&
          state.isOpen ? (
          <form
            id="form"
            onSubmit={(event) => {
              event.preventDefault();
              onDeliveryOrderGroup();
            }}
          >
            <OrderGroupActionDetails
              group={selectedGroup}
              action="delivery"
            />
          </form>
        ) : isAddingToGroup && state.isOpen ? (
          <form
            id="form"
            onSubmit={(event) => {
              event.preventDefault();
              onAddOrdersToGroup();
            }}
          >
            <AddOrdersToGroupDetails
              group={selectedGroup}
              data={groupCandidatesQuery.data ?? null}
              isLoading={groupCandidatesQuery.isLoading}
              isError={groupCandidatesQuery.isError}
              errorMessage={
                groupCandidatesQuery.error instanceof Error
                  ? groupCandidatesQuery.error.message
                  : undefined
              }
              selectedIds={selectedCandidateIds}
              onToggle={toggleCandidate}
            />
          </form>
        ) : isSeparatingOrder && state.isOpen ? (
          <form
            id="form"
            onSubmit={(event) => {
              event.preventDefault();
              onSeparateOrder();
            }}
          >
            <SeparateOrderDetails
              order={matchedOrderDetail}
              isLoading={orderDetailQuery.isLoading}
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

        <DialogFooter
          className={
            workspaceLayout
              ? "mx-0 mb-0 flex-row flex-wrap items-center justify-end gap-2 rounded-none border-t bg-background px-5 py-3.5 sm:px-6"
              : ""
          }
        >
          {state.mode === DialogMode.INSERT ? (
            <>
              <OrderSubmissionStatus />
              <Button
                type="button"
                variant="outline"
                className="min-h-9 flex-1 sm:flex-none"
                onClick={() => setStep((current) => Math.max(current - 1, 0))}
                disabled={
                  step === 0 || nextPending || form.formState.isSubmitting
                }
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </Button>

              {step < steps.length - 1 && (
                <Button
                  type="button"
                  className="min-h-9 flex-1 sm:flex-none"
                  onClick={handleNext}
                  disabled={nextPending}
                >
                  {nextPending ? "Checking..." : `Next: ${steps[step + 1].title}`}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              )}

              {step === steps.length - 1 && (
                <Button type="button" variant="outline" className="min-h-9 flex-1 sm:flex-none" disabled={form.formState.isSubmitting || nextPending || orderCount >= 25} onClick={() => {
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
                  className="min-h-9 flex-1 sm:flex-none"
                  disabled={
                    !state.isOpen ||
                    form.formState.isSubmitting ||
                    actionPending
                  }
                  type="submit"
                  form="form"
                >
                  {form.formState.isSubmitting && (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  )}
                  {form.formState.isSubmitting ? (orderCount > 1 ? `Creating ${orderCount} orders...` : "Creating order...") : (orderCount > 1 ? `Create ${orderCount} orders` : "Create order")}
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
                  (isAddingToGroup
                    ? !selectedGroup?.order_group_id ||
                      groupCandidatesQuery.isFetching ||
                      groupCandidatesQuery.isError ||
                      selectedCandidateIds.length === 0
                    : isGroupAction
                      ? !selectedGroup?.order_group_id
                      : editing
                        ? !matchedOrderDetail || orderDetailQuery.isError
                        : isSeparatingOrder
                          ? orderDetailQuery.isFetching ||
                            orderDetailQuery.isError ||
                            !matchedOrderDetail ||
                            !matchedOrderDetail.order_group_id
                          : orderDetailQuery.isFetching ||
                            orderDetailQuery.isError ||
                            !orderDetailQuery.data)
                }
                type="submit"
                form="form"
              >
                {(form.formState.isSubmitting || actionPending) && (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                )}
                {isAddingToGroup
                  ? selectedCandidateIds.length > 0
                    ? `Add ${selectedCandidateIds.length} ${selectedCandidateIds.length === 1 ? "Order" : "Orders"}`
                    : state.action
                  : isSeparatingOrder &&
                      matchedOrderDetail?.order_group_size != null &&
                      matchedOrderDetail.order_group_size <= 2
                    ? "Separate & Dissolve Group"
                    : state.action}
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
      <div className="flex justify-center py-10">
        <Loader2
          className="size-6 animate-spin text-muted-foreground"
          aria-label="Loading order"
        />
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

  const { total, paymentStatus } = getOrderPaymentSummary(order);
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const isProcess = action === "process";
  const fromStatus = isProcess ? "PENDING" : "PROCESSING";
  const toStatus = isProcess ? "PROCESSING" : "SCHEDULING";

  return (
    <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
      {/* Status Transition Banner */}
      <div
        className={`rounded-lg border p-3.5 ${
          isProcess
            ? "border-blue-200/80 bg-blue-50/50 dark:border-blue-900/70 dark:bg-blue-950/25"
            : "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/70 dark:bg-emerald-950/25"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 ${getOrderStatusBadgeClass(fromStatus)}`}
          >
            {formatOrderLabel(fromStatus)}
          </span>
          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 ${getOrderStatusBadgeClass(toStatus)}`}
          >
            {formatOrderLabel(toStatus)}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {isProcess
            ? "Confirm stock availability to begin preparing these items for fulfillment."
            : "Confirm all items are checked and packed. This will issue the invoice and make the order available in Delivery Schedules."}
        </p>
      </div>

      {/* Compact Order Summary */}
      <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3.5 sm:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Order No.</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold">
            {order.order_number}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Customer</dt>
          <dd className="mt-0.5 truncate text-sm font-medium">
            {order.customer_name}
          </dd>
          {order.customer_company && (
            <dd className="truncate text-xs text-muted-foreground">
              {order.customer_company}
            </dd>
          )}
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Warehouse</dt>
          <dd className="mt-0.5 truncate text-sm font-medium">
            {order.warehouse_name || "—"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Order Total</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {total === null ? "Unverified" : formatCurrency(total)}
          </dd>
          <dd className="text-[11px] text-muted-foreground">
            {formatOrderLabel(paymentStatus)} ·{" "}
            {formatOrderLabel(order.payment_arrangement)}
          </dd>
        </div>
      </dl>

      {/* Items Checklist Table */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isProcess ? "Items to Prepare" : "Prepared Items"}
          </h3>
          <span className="text-xs text-muted-foreground">
            {order.items.length} {order.items.length === 1 ? "item" : "items"} ·{" "}
            {totalUnits} {totalUnits === 1 ? "unit" : "units"}
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead scope="col">Item</TableHead>
                <TableHead scope="col">SKU</TableHead>
                <TableHead scope="col" className="text-right">
                  Qty
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => {
                const showProduct =
                  item.product_name &&
                  item.product_name !== item.product_variant_name;
                return (
                  <TableRow key={item.inventory_id}>
                    <TableCell className="whitespace-normal">
                      {showProduct && (
                        <div className="text-xs text-muted-foreground">
                          {item.product_name}
                        </div>
                      )}
                      <div className="font-medium">
                        {item.product_variant_name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.product_variant_sku}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {item.price === null
                        ? "Unverified"
                        : formatCurrency(item.price * item.quantity)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Shipping Destination & Special Notes */}
      {(order.shipping_address || order.notes?.trim()) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {order.shipping_address && (
            <section
              className={`space-y-1 rounded-lg border p-3.5 ${
                !order.notes?.trim() ? "sm:col-span-2" : ""
              }`}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Shipping Destination
              </h3>
              {(order.shipping_recipient || order.shipping_phone) && (
                <p className="text-sm font-medium">
                  {[order.shipping_recipient, order.shipping_phone]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                {order.shipping_address}
              </p>
            </section>
          )}
          {order.notes?.trim() && (
            <section
              className={`space-y-1 rounded-lg border border-amber-200/80 bg-amber-50/40 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/20 ${
                !order.shipping_address ? "sm:col-span-2" : ""
              }`}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Order Notes
              </h3>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                {order.notes}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function OrderGroupActionDetails({
  group,
  action,
}: {
  group: OrderTableRow | null;
  action: "process" | "delivery";
}) {
  if (!group || !group.members?.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Unable to load this order group. Close the dialog and try again.
      </p>
    );
  }

  const isProcess = action === "process";
  const fromStatus = isProcess ? "PENDING" : "PROCESSING";
  const toStatus = isProcess ? "PROCESSING" : "SCHEDULING";
  const eligible = group.members.filter(
    (member) =>
      member.status === fromStatus && member.delivery_type !== "WALK_IN",
  );
  const skippedCount = group.members.length - eligible.length;

  return (
    <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
      <div
        className={`rounded-lg border p-3.5 ${
          isProcess
            ? "border-blue-200/80 bg-blue-50/50 dark:border-blue-900/70 dark:bg-blue-950/25"
            : "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/70 dark:bg-emerald-950/25"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 ${getOrderStatusBadgeClass(fromStatus)}`}
          >
            {formatOrderLabel(fromStatus)}
          </span>
          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 ${getOrderStatusBadgeClass(toStatus)}`}
          >
            {formatOrderLabel(toStatus)}
          </span>
          <span className="text-muted-foreground">
            · {eligible.length} {eligible.length === 1 ? "order" : "orders"}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {isProcess
            ? "Start processing all pending orders in this group at once."
            : "Confirm all processing orders in this group are packed. This issues their invoices and moves them to Delivery Schedules."}
          {skippedCount > 0
            ? ` ${skippedCount} other ${skippedCount === 1 ? "order" : "orders"} in this group will remain unchanged.`
            : ""}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3.5 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Order Group</dt>
          <dd
            className="mt-0.5 truncate font-mono text-sm font-semibold"
            title={group.order_group_number ?? undefined}
          >
            {formatOrderGroupCode(group.order_group_number) || "Group"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Customer</dt>
          <dd className="mt-0.5 truncate text-sm font-medium">
            {group.customer_name}
          </dd>
          {group.customer_company && (
            <dd className="truncate text-xs text-muted-foreground">
              {group.customer_company}
            </dd>
          )}
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Updating</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {eligible.length} of {group.members.length} orders
          </dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Orders Included
        </h3>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead scope="col">Order</TableHead>
                <TableHead scope="col">Destination</TableHead>
                <TableHead scope="col" className="text-right">
                  Items
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eligible.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="whitespace-nowrap">
                    <div className="font-medium">{member.product_number}</div>
                    {member.order_group_position != null && (
                      <div className="text-xs text-muted-foreground">
                        #{member.order_group_position} of {group.members!.length}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal text-xs text-muted-foreground">
                    {member.shipping_address || "Address unavailable"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-xs tabular-nums">
                    {member.item_count} ({member.total_quantity}u)
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                    {member.total === null
                      ? "Unverified"
                      : formatCurrency(member.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function SeparateOrderDetails({
  order,
  isLoading,
}: {
  order: OrderDetail | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2
          className="size-6 animate-spin text-muted-foreground"
          aria-label="Loading order"
        />
      </div>
    );
  }

  if (!order) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Unable to load this order. Close the dialog and try again.
      </p>
    );
  }

  if (!order.order_group_id) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        This order is already an independent order and is no longer part of a group.
      </p>
    );
  }

  const { total } = getOrderPaymentSummary(order);
  const groupCode = formatOrderGroupCode(order.order_group_number) || "Order Group";
  const totalMembers = order.order_group_size ?? order.group_members?.length ?? 0;
  const remainingCount = Math.max(totalMembers - 1, 0);
  const willDissolve = remainingCount <= 1;
  const siblings = (order.group_members ?? []).filter((member) => member.id !== order.id);
  const lastRemaining = siblings.length === 1 ? siblings[0] : null;

  return (
    <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
      <div
        className={`rounded-lg border p-3.5 ${
          willDissolve
            ? "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/70 dark:bg-amber-950/25"
            : "border-blue-200/80 bg-blue-50/50 dark:border-blue-900/70 dark:bg-blue-950/25"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <Unlink
            className={`size-3.5 shrink-0 ${
              willDissolve
                ? "text-amber-700 dark:text-amber-400"
                : "text-blue-700 dark:text-blue-400"
            }`}
            aria-hidden="true"
          />
          <span>
            {willDissolve
              ? "Group will be automatically dissolved"
              : `${remainingCount} orders will remain in ${groupCode}`}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {willDissolve
            ? lastRemaining
              ? `Separating ${order.order_number} leaves only 1 order (${lastRemaining.order_number}) in group ${groupCode}. The group will be automatically dissolved and both orders will become independent orders.`
              : `Separating ${order.order_number} leaves only 1 order in group ${groupCode}. The group will be automatically dissolved and the remaining order will become an independent order.`
            : `${order.order_number} will become an independent order, while group ${groupCode} will continue with ${remainingCount} orders.`}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Order items, status, shipping details, invoices, and recorded or combined payment allocations will remain unchanged.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3.5 sm:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Order No.</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold">
            {order.order_number}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Current Group</dt>
          <dd
            className="mt-0.5 flex items-center gap-1 truncate font-mono text-sm font-medium"
            title={order.order_group_number ?? undefined}
          >
            <Layers className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{groupCode}</span>
          </dd>
          <dd className="text-[11px] text-muted-foreground tabular-nums">
            {order.order_group_position != null
              ? `#${order.order_group_position} of ${totalMembers}`
              : `${totalMembers} orders`}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="mt-1">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getOrderStatusBadgeClass(order.status)}`}
            >
              {formatOrderLabel(order.status)}
            </span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Order Total</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {total === null ? "Unverified" : formatCurrency(total)}
          </dd>
        </div>
      </dl>

      {siblings.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {willDissolve
              ? "Remaining Order Becoming Independent"
              : "Orders Remaining in Group"}
          </h3>
          <ul className="divide-y rounded-lg border">
            {siblings.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {member.order_number}
                    </span>
                    {member.shipping_address && (
                      <span className="truncate text-muted-foreground">
                        · {member.shipping_address}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getOrderStatusBadgeClass(member.status)}`}
                  >
                    {formatOrderLabel(member.status)}
                  </span>
                  <span className="min-w-16 text-right font-medium tabular-nums">
                    {member.total === null
                      ? "Unverified"
                      : formatCurrency(member.total)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AddOrdersToGroupDetails({
  group,
  data,
  isLoading,
  isError,
  errorMessage,
  selectedIds,
  onToggle,
}: {
  group: OrderTableRow | null;
  data: GroupCandidatesResponse | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  selectedIds: number[];
  onToggle: (orderId: number, checked: boolean, maxSelectable: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2
          className="size-6 animate-spin text-muted-foreground"
          aria-label="Loading eligible orders"
        />
      </div>
    );
  }

  if (isError || !data || !group) {
    return (
      <p role="alert" className="py-8 text-center text-sm text-destructive">
        {errorMessage || "Unable to load eligible orders for this group. Close the dialog and try again."}
      </p>
    );
  }

  const groupCode = formatOrderGroupCode(data.group_number) || "Group";
  const remainingSlots = Math.max(data.max_size - data.current_size, 0);

  return (
    <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
      <div className="rounded-lg border border-blue-200/80 bg-blue-50/50 p-3.5 dark:border-blue-900/70 dark:bg-blue-950/25">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <Link2 className="size-3.5 shrink-0 text-blue-700 dark:text-blue-400" aria-hidden="true" />
          <span>Same-customer orders only</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Showing eligible independent pre-dispatch orders for{" "}
          <span className="font-medium text-foreground">{data.customer_name}</span>
          {data.customer_company ? ` (${data.customer_company})` : ""}. All order items, statuses, invoices, and payment allocations will be preserved.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3.5 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Order Group</dt>
          <dd
            className="mt-0.5 truncate font-mono text-sm font-semibold"
            title={data.group_number}
          >
            {groupCode}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Customer</dt>
          <dd className="mt-0.5 truncate text-sm font-medium">
            {data.customer_name}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Group Size</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {data.current_size + selectedIds.length} of {data.max_size} max
          </dd>
        </div>
      </dl>

      {data.candidates.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No eligible independent orders found for {data.customer_name}.
        </p>
      ) : (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Eligible Independent Orders ({data.candidates.length})
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {selectedIds.length} selected · {remainingSlots} {remainingSlots === 1 ? "slot" : "slots"} left
            </span>
          </div>
          <ul className="divide-y rounded-lg border">
            {data.candidates.map((candidate) => {
              const checked = selectedIds.includes(candidate.id);
              const limitReached = !checked && selectedIds.length >= remainingSlots;
              const checkboxId = `group-candidate-${candidate.id}`;
              return (
                <li
                  key={candidate.id}
                  className={`flex items-start gap-3 px-3 py-2.5 text-xs transition-colors ${
                    checked ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    disabled={limitReached}
                    onCheckedChange={(next) =>
                      onToggle(candidate.id, Boolean(next), remainingSlots)
                    }
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={checkboxId}
                    className={`flex min-w-0 flex-1 cursor-pointer flex-wrap items-center justify-between gap-2 ${
                      limitReached ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {candidate.order_number}
                        </span>
                        {candidate.warehouse_name && (
                          <span className="text-muted-foreground">
                            · {candidate.warehouse_name}
                          </span>
                        )}
                      </div>
                      {candidate.shipping_address && (
                        <p className="truncate text-muted-foreground">
                          {candidate.shipping_address}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getOrderStatusBadgeClass(candidate.status)}`}
                      >
                        {formatOrderLabel(candidate.status)}
                      </span>
                      <span className="min-w-16 text-right font-medium tabular-nums">
                        {candidate.total === null
                          ? "Unverified"
                          : formatCurrency(candidate.total)}
                      </span>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
