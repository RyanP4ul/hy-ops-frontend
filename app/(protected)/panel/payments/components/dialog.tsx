"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { PaginatedCombobox } from "@/components/paginated-combobox";
import { DialogMode } from "@/types/dialog";
import { useModal } from "@/components/providers/modal-provider";
import { useWebSocket } from "@/components/providers/websocket-provider";
import { request, requestWithErrorHandling } from "@/components/http";
import { ToastValidationError } from "@/components/util";
import { formatCurrency } from "@/utils/date-util";
import { REQUESTS } from "@/constant/request";
import { resourceQueryRoots } from "@/lib/realtime";
import type { PaymentFormType, PaymentRowType } from "@/schema/payment";
import { usePayments } from "../provider";

function canCollect(payment: PaymentRowType) {
  return payment.order_status !== "CANCELLED" && payment.payment_status !== "UNVERIFIED" && payment.remaining_amount !== null && Number.isFinite(Number(payment.remaining_amount)) && Number(payment.remaining_amount) > 0;
}
function unavailableReason(payment: PaymentRowType) {
  if (payment.order_status === "CANCELLED") return "Cancelled order";
  if (payment.payment_status === "UNVERIFIED" || payment.remaining_amount === null) return "Unverified order total";
  if (!Number.isFinite(Number(payment.remaining_amount))) return "Balance unavailable";
  return "No remaining balance";
}
const money = (value: string | number | null | undefined) => value == null ? "Unverified" : formatCurrency(value);

export default function PaymentDialog() {
  const { state, dispatch } = useModal();
  const { form, paymentsQuery, selected, setSelected } = usePayments();
  const { send } = useWebSocket();
  const cache = useQueryClient();
  const initialized = useRef<string | null>(null), submitting = useRef(false);
  const [pickerPage, setPickerPage] = useState(0), [pickerSearch, setPickerSearch] = useState("");
  const choosingOrder = state.mode === DialogMode.INSERT;
  const readOnly = state.mode === DialogMode.VIEW;
  const picker = useQuery({
    queryKey: ["payments", "picker", pickerPage, pickerSearch],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ page: String(pickerPage), limit: "10", search: pickerSearch, sort_by: "id:desc" });
      const response = await fetch(`/api/payments?${params}`, { credentials: "include", signal });
      const authenticated = response.status === 401 ? await request("GET", `/api/payments?${params}`) : response;
      const rows: unknown = await authenticated.json().catch(() => null);
      if (!authenticated.ok || !Array.isArray(rows)) throw new Error("Unable to load orders for payment. Please retry.");
      return { rows: rows as PaymentRowType[], total: Number(authenticated.headers.get("X-Total-Count") ?? 0) };
    },
    enabled: state.isOpen && choosingOrder,
    retry: 1,
  });
  const selectedPayment = paymentsQuery.data?.rows.find(payment => payment.payment_number === selected.payment_number) ?? selected.payment;
  const amount = form.watch("payment_amount");
  const collectible = Boolean(selectedPayment && canCollect(selectedPayment));
  const stale = Boolean(selectedPayment && form.getValues("version") !== selectedPayment.version);
  const remainingCents = selectedPayment?.remaining_amount == null ? null : Math.round(Number(selectedPayment.remaining_amount) * 100);
  const amountCents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;

  useEffect(() => {
    if (!state.isOpen) { initialized.current = null; setPickerPage(0); setPickerSearch(""); return; }
    const key = `${selected.payment_number}:${state.mode}`;
    if (initialized.current === key || !selectedPayment) return;
    initialized.current = key;
    form.reset({ order_id: selectedPayment.order_id, payment_number: selectedPayment.payment_number, payment_amount: 0, version: selectedPayment.version });
  }, [state.isOpen, state.mode, selected.payment_number, selectedPayment, form]);

  async function onSubmit(data: PaymentFormType) {
    if (submitting.current || readOnly) return;
    form.clearErrors("root");
    if (!selectedPayment || !canCollect(selectedPayment) || data.payment_number !== selectedPayment.payment_number || remainingCents === null) {
      form.setError("root", { message: "Choose an active order with a verified outstanding balance." }); return;
    }
    if (data.version !== selectedPayment.version) {
      form.setError("root", { message: "This payment changed. Close and reopen Add payment to review its current balance." }); return;
    }
    const cents = Math.round(data.payment_amount * 100);
    if (cents > remainingCents || cents <= 0 || Math.abs(data.payment_amount * 100 - cents) > 0.000001) {
      form.setError("payment_amount", { message: "Enter an amount in pesos and centavos, greater than zero and within the remaining balance." }); return;
    }
    submitting.current = true;
    try {
      await requestWithErrorHandling(await request("POST", "/api/payments", { payment_number: data.payment_number, payment_amount: data.payment_amount, version: data.version }), form, result => {
        for (const root of resourceQueryRoots.payments) void cache.invalidateQueries({ queryKey: [root] });
        send({ type: REQUESTS.PAYMENT_UPDATED, payload: [JSON.stringify(result)] });
        dispatch({ type: "CLOSE" });
      });
    } catch {
      form.setError("root", { message: "Payment submission was not confirmed. Check the payment records before trying again." });
    } finally { submitting.current = false; }
  }

  return <DialogContent className="sm:max-w-xl" showCloseButton={!form.formState.isSubmitting} onKeyDown={event => { if (event.key === "Escape" && submitting.current) { event.preventDefault(); event.stopPropagation(); } }}>
    <DialogHeader><DialogTitle>{state.title}</DialogTitle><DialogDescription>{state.description}</DialogDescription></DialogHeader>
    {choosingOrder && <PaginatedCombobox<PaymentRowType>
      id="payment-order" label="Order / payment record" value={selected.payment_number || null}
      selectedLabel={selectedPayment ? `Order #${selectedPayment.order_id} / ${selectedPayment.payment_number}` : ""}
      options={picker.data?.rows ?? []} getOptionValue={payment => payment.payment_number}
      getOptionDisabled={payment => !canCollect(payment)} disabled={form.formState.isSubmitting}
      renderOption={payment => <span className="grid min-w-0 gap-1"><span className="break-words text-sm font-medium">Order #{payment.order_id} / {payment.customer_name || `Customer #${payment.customer_id}`}</span><span className="break-all text-xs text-muted-foreground">{payment.payment_number} / {canCollect(payment) ? `${money(payment.remaining_amount)} remaining` : unavailableReason(payment)}</span></span>}
      onValueChange={(_, payment) => {
        initialized.current = null;
        setSelected(payment ? { order_id: payment.order_id, payment_number: payment.payment_number, version: payment.version, payment } : { order_id: -1, payment_number: "", version: -1 });
        form.reset({ order_id: payment?.order_id ?? -1, payment_number: payment?.payment_number ?? "", payment_amount: 0, version: payment?.version ?? -1 });
      }}
      onSearchChange={setPickerSearch} page={pickerPage} totalPages={Math.ceil((picker.data?.total ?? 0) / 10)} onPageChange={setPickerPage} isLoading={picker.isFetching}
      placeholder="Search customer or payment number" emptyMessage="No matching payment records. Try another customer or payment number."
      error={picker.isError ? <div role="alert" className="text-sm text-destructive"><p>{picker.error.message}</p><Button type="button" variant="outline" size="sm" onClick={() => void picker.refetch()}>Retry orders</Button></div> : undefined}
    />}
    {choosingOrder && <p className="text-xs leading-relaxed text-muted-foreground">Select an existing order to add a partial or full payment. Cancelled orders, unverified totals and records with no balance are unavailable.</p>}
    {selectedPayment && <section aria-label="Selected order payment summary" className="space-y-3 rounded-lg border bg-muted/25 p-4">
      <div><p className="text-sm font-semibold">Order #{selectedPayment.order_id} / {selectedPayment.customer_name || `Customer #${selectedPayment.customer_id}`}</p><p className="mt-1 break-all text-xs text-muted-foreground">{selectedPayment.payment_number}</p></div>
      <dl className="grid grid-cols-2 gap-3 text-sm">{[
        ["Total received", money(selectedPayment.gross_received)], ["Refunded", money(selectedPayment.refunded_amount)],
        ["Net received", money(selectedPayment.amount)], ["Remaining balance", money(selectedPayment.remaining_amount)],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium tabular-nums">{value}</dd></div>)}</dl>
      <p className="text-xs text-muted-foreground">Payment method: {({ CASH: "Cash", BANK_TRANSFER: "Bank transfer", CARD: "Card" })[selectedPayment.payment_method] ?? selectedPayment.payment_method}</p>
      {selectedPayment.combined_payment_number && <p className="text-xs text-muted-foreground">Combined payment: {selectedPayment.combined_payment_number}. Original combined receipt: {money(selectedPayment.combined_payment_amount ?? null)}. Original allocation to this order: {money(selectedPayment.combined_payment_allocation ?? null)}. {selectedPayment.combined_payment_reference && <>Reference: {selectedPayment.combined_payment_reference}. </>}Receipts and refunds below apply only to this order.</p>}
      {selectedPayment.payment_type && <p className="break-words text-xs text-muted-foreground">Payment type: {selectedPayment.payment_type}</p>}
    </section>}
    {form.formState.errors.root && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
    {selectedPayment && !collectible && !readOnly && <p role="status" className="text-sm text-muted-foreground">Payments cannot be added: {unavailableReason(selectedPayment).toLowerCase()}.</p>}
    {stale && !readOnly && <p role="alert" className="text-sm text-destructive">This payment changed. Close and reopen Add payment to review the current balance.</p>}
    {!readOnly && <form id="payment-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit, error => ToastValidationError(error))}>
      <Controller control={form.control} name="payment_amount" render={({ field, fieldState }) => <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor="payment_amount">Amount received (PHP) <span className="text-destructive">*</span></FieldLabel>
        <Input {...field} id="payment_amount" type="number" inputMode="decimal" min={0.01} step={0.01} max={remainingCents === null ? undefined : remainingCents / 100}
          value={Number.isFinite(field.value) ? field.value : ""} disabled={!collectible || stale || form.formState.isSubmitting}
          aria-invalid={fieldState.invalid} placeholder="Enter the amount received" autoComplete="off" onChange={event => field.onChange(event.target.valueAsNumber)} />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>} />
      {collectible && !stale && <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Record money already received from the customer.</p><Button type="button" variant="outline" size="sm" disabled={form.formState.isSubmitting} onClick={() => form.setValue("payment_amount", remainingCents! / 100, { shouldValidate: true, shouldDirty: true })}>Use full balance</Button></div>}
      {collectible && amountCents > 0 && remainingCents !== null && amountCents <= remainingCents && <p className="rounded-md bg-muted/50 p-3 text-sm">Balance after this payment: <strong className="tabular-nums">{formatCurrency((remainingCents - amountCents) / 100)}</strong></p>}
    </form>}
    <DialogFooter><DialogClose render={<Button type="button" variant="outline" disabled={form.formState.isSubmitting}>{readOnly ? "Close" : "Cancel"}</Button>} />
      {!readOnly && <Button type="submit" form="payment-form" disabled={form.formState.isSubmitting || !collectible || stale || !Number.isFinite(amount) || amountCents <= 0 || remainingCents === null || amountCents > remainingCents}>
        {form.formState.isSubmitting && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}{form.formState.isSubmitting ? "Recording payment..." : "Record payment"}
      </Button>}
    </DialogFooter>
  </DialogContent>;
}
