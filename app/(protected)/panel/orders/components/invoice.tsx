"use client";

import type { CombinedPaymentInfo } from "@/schema/order";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/utils/date-util";
import { request } from "@/components/http";

type InvoiceItem = {
  id: number;
  name: string;
  variantName?: string;
  sku?: string;
  description?: string;
  quantity: number;
  unitPrice: number | null;
};

type Invoice = {
  salesChannel?: "STANDARD" | "WALK_IN";
  orderNumber?: string;
  warehouseName?: string;
  combinedPayment?: CombinedPaymentInfo | null;
  paymentMethod?: string | null;
  paymentType?: string | null;
  invoiceNumber: string;
  status: "DRAFT" | "ISSUED" | "VOID";
  issueDate: string;
  dueDate: string;
  paymentArrangement:
    | "FULLY_PAID"
    | "PARTIALLY_PAID"
    | "NET_30"
    | "PAY_ON_DELIVERY";
  paymentStatus:
    | "UNPAID"
    | "PARTIALLY_PAID"
    | "PAID"
    | "OVERDUE"
    | "UNVERIFIED";
  customer: {
    name: string;
    companyName?: string;
    address: string;
    email?: string;
    phone?: string;
  };
  items: InvoiceItem[];
  discount: number;
  tax: number;
  otherCharges: number;
  amountPaid: number;
  notes?: string;
};

type InvoiceResponse = {
  combined_payment?: CombinedPaymentInfo | null;
  payment_method?: string | null;
  payment_type?: string | null;
  sales_channel?: "STANDARD" | "WALK_IN";
  order_number?: string;
  warehouse_name?: string;
  invoice_number: string;
  status: Invoice["status"];
  issue_date: string;
  due_date: string;
  payment_arrangement: Invoice["paymentArrangement"];
  payment_status: Invoice["paymentStatus"];
  amount_paid: number;
  customer: {
    name: string;
    company_name?: string;
    address: string;
    email?: string;
    phone?: string;
  };
  items: {
    id: number;
    name: string;
    variant_name?: string;
    sku?: string;
    description?: string;
    quantity: number;
    unit_price: number | null;
  }[];
  discount: number;
  tax: number;
  other_charges: number;
  notes?: string;
};

const company = {
  name: "HY COMPANY",
  address: "Guiguinto, Bulacan, Philippines",
  phone: "",
  email: "",
};

function formatEnumLabel(value?: string | null): string {
  if (!value) return "Not specified";
  const overrides: Record<string, string> = {
    NET_30: "Net 30",
    FULLY_PAID: "Fully Paid",
    PARTIALLY_PAID: "Partially Paid",
    PAY_ON_DELIVERY: "Pay on Delivery",
    BANK_TRANSFER: "Bank Transfer",
    CASH: "Cash",
    CHEQUE: "Cheque",
    CHECK: "Check",
    E_WALLET: "E-Wallet",
    GCASH: "GCash",
    PAID: "Paid",
    UNPAID: "Unpaid",
    OVERDUE: "Overdue",
    UNVERIFIED: "Unverified",
    VOID: "Void",
  };
  if (overrides[value]) return overrides[value];
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// jsPDF's built-in Helvetica font does not render the Unicode peso sign (₱)
// cleanly. Use ASCII-only currency text in the generated PDF.
function formatPdfCurrency(amount: number | null) {
  if (amount === null) return "Unverified";
  const formatted = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `PHP ${formatted}`;
}

function formatDate(date: string) {
  if (!date) return "—";

  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return date;

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsedDate);
}

function getLineTotal(item: InvoiceItem) {
  return item.unitPrice === null ? null : item.quantity * item.unitPrice;
}

function getInvoiceSubtotal(invoice: Invoice) {
  if (invoice.items.some((item) => item.unitPrice === null)) return null;
  return invoice.items.reduce(
    (sum, item) => sum + (getLineTotal(item) ?? 0),
    0,
  );
}

function getInvoiceTotal(invoice: Invoice) {
  const subtotal = getInvoiceSubtotal(invoice);
  if (subtotal === null) return null;
  return Math.max(
    0,
    subtotal - invoice.discount + invoice.tax + invoice.otherCharges,
  );
}

function getBalanceDue(invoice: Invoice) {
  const total = getInvoiceTotal(invoice);
  return total === null ? null : Math.max(0, total - invoice.amountPaid);
}

function paymentStatusPillClass(status: Invoice["paymentStatus"]) {
  switch (status) {
    case "PAID":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "PARTIALLY_PAID":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
    case "OVERDUE":
    case "UNPAID":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export default function Invoice({
  orderId,
  actionContainer,
}: {
  orderId: number;
  actionContainer?: HTMLElement | null;
}) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const invoiceQuery = useQuery({
    queryKey: ["invoice", orderId],
    queryFn: async () => {
      const response = await request("GET", `/api/invoice/${orderId}`);
      if (!response.ok) throw new Error("Failed to fetch invoice");
      return (await response.json()) as InvoiceResponse;
    },
    enabled: orderId > 0,
  });

  if (invoiceQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading invoice…
      </div>
    );
  }

  if (invoiceQuery.isError || !invoiceQuery.data) {
    return (
      <div role="alert" className="space-y-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Unable to load this invoice.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={invoiceQuery.isFetching}
          onClick={() => void invoiceQuery.refetch()}
        >
          Retry invoice
        </Button>
      </div>
    );
  }

  const invoice: Invoice = {
    combinedPayment: invoiceQuery.data.combined_payment,
    paymentMethod: invoiceQuery.data.payment_method,
    paymentType: invoiceQuery.data.payment_type,
    salesChannel: invoiceQuery.data.sales_channel,
    orderNumber: invoiceQuery.data.order_number,
    warehouseName: invoiceQuery.data.warehouse_name,
    invoiceNumber: invoiceQuery.data.invoice_number,
    status: invoiceQuery.data.status,
    issueDate: invoiceQuery.data.issue_date,
    dueDate: invoiceQuery.data.due_date,
    paymentArrangement: invoiceQuery.data.payment_arrangement,
    paymentStatus: invoiceQuery.data.payment_status,
    customer: {
      name: invoiceQuery.data.customer.name,
      companyName: invoiceQuery.data.customer.company_name,
      address: invoiceQuery.data.customer.address,
      email: invoiceQuery.data.customer.email,
      phone: invoiceQuery.data.customer.phone,
    },
    items: invoiceQuery.data.items.map((item) => ({
      id: item.id,
      name: item.name,
      variantName: item.variant_name,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
    discount: invoiceQuery.data.discount,
    tax: invoiceQuery.data.tax,
    otherCharges: invoiceQuery.data.other_charges,
    amountPaid: invoiceQuery.data.amount_paid,
    notes: invoiceQuery.data.notes?.trim() || undefined,
  };

  const subtotal = getInvoiceSubtotal(invoice);
  const total = getInvoiceTotal(invoice);
  const balanceDue = getBalanceDue(invoice);
  const showDueDate = invoice.paymentArrangement === "NET_30";
  const formattedMethod = invoice.paymentMethod
    ? `${formatEnumLabel(invoice.paymentMethod)}${invoice.paymentType ? ` (${invoice.paymentType})` : ""}`
    : "Not specified";

  async function handleGeneratePdf() {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      doc.setCharSpace(0);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const rightEdge = pageWidth - margin;

      // Company heading
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(25, 25, 25);
      doc.text(company.name, margin, 22);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(95, 95, 95);
      let leftY = 28;
      doc.text(company.address, margin, leftY);
      leftY += 5;
      if (invoice.warehouseName) {
        doc.text(`Warehouse: ${invoice.warehouseName}`, margin, leftY);
        leftY += 5;
      }
      if (company.phone) {
        doc.text(`Phone: ${company.phone}`, margin, leftY);
        leftY += 5;
      }
      if (company.email) {
        doc.text(`Email: ${company.email}`, margin, leftY);
        leftY += 5;
      }

      // Invoice title and core metadata
      doc.setTextColor(25, 25, 25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(
        invoice.salesChannel === "WALK_IN" ? "WALK-IN INVOICE" : "INVOICE",
        rightEdge,
        22,
        { align: "right" },
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      let metaY = 29;
      doc.text(`Invoice No.: ${invoice.invoiceNumber}`, rightEdge, metaY, {
        align: "right",
      });
      metaY += 5;
      if (invoice.orderNumber) {
        doc.text(`Order No.: ${invoice.orderNumber}`, rightEdge, metaY, {
          align: "right",
        });
        metaY += 5;
      }
      doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, rightEdge, metaY, {
        align: "right",
      });
      metaY += 5;
      if (showDueDate) {
        doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, rightEdge, metaY, {
          align: "right",
        });
        metaY += 5;
      }

      const statusText =
        invoice.status === "VOID"
          ? `Void (${formatEnumLabel(invoice.paymentStatus)})`
          : formatEnumLabel(invoice.paymentStatus);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(25, 25, 25);
      doc.text(`Status: ${statusText}`, rightEdge, metaY, { align: "right" });

      // Divider
      const dividerY = Math.max(leftY + 3, metaY + 6);
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, dividerY, rightEdge, dividerY);

      // Bill To & Payment Info (no duplicate financial totals here)
      const billToLines = [
        invoice.customer.companyName,
        invoice.customer.name,
        invoice.customer.address,
        invoice.customer.phone,
        invoice.customer.email,
      ].filter(Boolean);

      const paymentInfoLines = [
        `Terms: ${formatEnumLabel(invoice.paymentArrangement)}`,
        `Method: ${formattedMethod}`,
        invoice.combinedPayment
          ? `Combined Payment: ${invoice.combinedPayment.payment_number}`
          : null,
        invoice.combinedPayment?.reference_number
          ? `Reference: ${invoice.combinedPayment.reference_number}`
          : null,
      ].filter(Boolean);

      autoTable(doc, {
        startY: dividerY + 4,
        margin: { left: margin, right: margin, bottom: 18 },
        head: [["BILL TO", "PAYMENT INFORMATION"]],
        body: [[billToLines.join("\n"), paymentInfoLines.join("\n")]],
        theme: "plain",
        headStyles: {
          fontStyle: "bold",
          fontSize: 8.5,
          textColor: [95, 95, 95],
          cellPadding: { top: 2, right: 3, bottom: 1.5, left: 0 },
        },
        styles: {
          font: "helvetica",
          fontSize: 9,
          textColor: [35, 35, 35],
          cellPadding: { top: 1, right: 3, bottom: 2, left: 0 },
          overflow: "linebreak",
        },
        columnStyles: {
          0: { cellWidth: 102 },
          1: { cellWidth: 76 },
        },
      });

      const getLastTableY = () =>
        (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? 85;

      // Line Items table with text wrapping
      autoTable(doc, {
        startY: getLastTableY() + 6,
        margin: { left: margin, right: margin, bottom: 18 },
        head: [["Item", "SKU", "Qty", "Unit Price", "Amount"]],
        body: invoice.items.map((item) => {
          const itemLabel = [item.name, item.variantName, item.description]
            .filter(Boolean)
            .join("\n");
          return [
            itemLabel,
            item.sku || "-",
            item.quantity.toLocaleString("en-PH"),
            formatPdfCurrency(item.unitPrice),
            formatPdfCurrency(getLineTotal(item)),
          ];
        }),
        theme: "grid",
        headStyles: {
          fillColor: [35, 45, 60],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
        },
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          cellPadding: 2.8,
          overflow: "linebreak",
          textColor: [40, 40, 40],
          lineColor: [225, 225, 225],
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { cellWidth: 62 },
          1: { cellWidth: 32 },
          2: { halign: "right", cellWidth: 16 },
          3: { halign: "right", cellWidth: 34 },
          4: { halign: "right", cellWidth: 34 },
        },
      });

      // Totals Summary (omit zero discount/tax/other charges)
      const totalsRows: [string, string][] = [
        ["Subtotal", formatPdfCurrency(subtotal)],
      ];
      if (invoice.discount > 0) {
        totalsRows.push(["Discount", `-${formatPdfCurrency(invoice.discount)}`]);
      }
      if (invoice.tax > 0) {
        totalsRows.push(["Tax", formatPdfCurrency(invoice.tax)]);
      }
      if (invoice.otherCharges > 0) {
        totalsRows.push([
          "Other Charges",
          formatPdfCurrency(invoice.otherCharges),
        ]);
      }
      totalsRows.push(["Total", formatPdfCurrency(total)]);
      totalsRows.push(["Amount Paid", formatPdfCurrency(invoice.amountPaid)]);
      totalsRows.push(["Balance Due", formatPdfCurrency(balanceDue)]);

      const totalRowIndex = totalsRows.findIndex(([label]) => label === "Total");
      const balanceRowIndex = totalsRows.length - 1;

      autoTable(doc, {
        startY: getLastTableY() + 6,
        margin: { left: 112, right: margin, bottom: 18 },
        body: totalsRows,
        theme: "plain",
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: { top: 2, right: 0, bottom: 2, left: 0 },
          textColor: [45, 45, 45],
        },
        columnStyles: {
          1: { halign: "right" },
        },
        didParseCell: (hookData) => {
          if (
            hookData.row.index === totalRowIndex ||
            hookData.row.index === balanceRowIndex
          ) {
            hookData.cell.styles.fontStyle = "bold";
            hookData.cell.styles.fontSize = 10;
            hookData.cell.styles.textColor = [20, 20, 20];
          }
        },
      });

      // Notes (only when present)
      if (invoice.notes) {
        autoTable(doc, {
          startY: getLastTableY() + 6,
          margin: { left: margin, right: margin, bottom: 22 },
          head: [["NOTES"]],
          body: [[invoice.notes]],
          theme: "plain",
          headStyles: {
            fontStyle: "bold",
            fontSize: 8.5,
            textColor: [95, 95, 95],
            cellPadding: { top: 2, right: 0, bottom: 1, left: 0 },
          },
          styles: {
            font: "helvetica",
            fontSize: 9,
            textColor: [55, 55, 55],
            cellPadding: { top: 1, right: 0, bottom: 2, left: 0 },
            overflow: "linebreak",
          },
        });
      }

      // Thank you note
      let closingY = getLastTableY() + 10;
      if (closingY > pageHeight - 20) {
        doc.addPage();
        closingY = 24;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(115, 115, 115);
      doc.text("Thank you for your business.", pageWidth / 2, closingY, {
        align: "center",
      });

      // Footer on every page (pure ASCII separator)
      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(125, 125, 125);
        doc.text(
          `${invoice.invoiceNumber} | Generated by HYOps`,
          margin,
          pageHeight - 9,
        );
        doc.text(`Page ${page} of ${pageCount}`, rightEdge, pageHeight - 9, {
          align: "right",
        });
      }

      doc.save(`${invoice.invoiceNumber}.pdf`);
    } catch (error) {
      console.error("Failed to generate invoice PDF:", error);
      window.alert("Unable to generate the PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  const pdfButton = (
    <Button
      type="button"
      onClick={() => void handleGeneratePdf()}
      disabled={isGeneratingPdf}
    >
      {isGeneratingPdf ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      {isGeneratingPdf ? "Generating PDF…" : "Generate PDF"}
    </Button>
  );

  return (
    <>
      <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1">
        {/* Document Header */}
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-base font-bold tracking-tight text-foreground">
              {company.name}
            </p>
            <p className="text-xs text-muted-foreground">{company.address}</p>
            {invoice.warehouseName && (
              <p className="text-xs text-muted-foreground">
                Warehouse: {invoice.warehouseName}
              </p>
            )}
          </div>
          <div className="space-y-1.5 sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {invoice.salesChannel === "WALK_IN"
                ? "Walk-in Invoice"
                : "Invoice"}
            </p>
            <p className="font-mono text-base font-semibold">
              {invoice.invoiceNumber}
            </p>
            <div className="flex flex-wrap gap-1.5 sm:justify-end">
              {invoice.status === "VOID" && (
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  Void
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${paymentStatusPillClass(invoice.paymentStatus)}`}
              >
                {formatEnumLabel(invoice.paymentStatus)}
              </span>
            </div>
          </div>
        </div>

        {/* Bill To & Invoice Metadata */}
        <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
          <section className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bill To
            </h3>
            <p className="pt-0.5 text-sm font-semibold text-foreground">
              {invoice.customer.companyName || invoice.customer.name}
            </p>
            {invoice.customer.companyName && (
              <p className="text-sm text-foreground">{invoice.customer.name}</p>
            )}
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              {invoice.customer.address}
            </p>
            {(invoice.customer.phone || invoice.customer.email) && (
              <p className="pt-0.5 text-xs text-muted-foreground">
                {[invoice.customer.phone, invoice.customer.email]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </section>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs md:justify-self-end">
            {invoice.orderNumber && (
              <>
                <dt className="text-muted-foreground">Order No.</dt>
                <dd className="text-right font-mono font-medium">
                  {invoice.orderNumber}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Issue Date</dt>
            <dd className="text-right font-medium">
              {formatDate(invoice.issueDate)}
            </dd>
            {showDueDate && (
              <>
                <dt className="text-muted-foreground">Due Date</dt>
                <dd className="text-right font-medium">
                  {formatDate(invoice.dueDate)}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Payment Terms</dt>
            <dd className="text-right font-medium">
              {formatEnumLabel(invoice.paymentArrangement)}
            </dd>
            <dt className="text-muted-foreground">Payment Method</dt>
            <dd className="text-right font-medium">{formattedMethod}</dd>
            {invoice.combinedPayment && (
              <>
                <dt className="text-muted-foreground">Combined Payment</dt>
                <dd className="break-all text-right font-mono font-medium">
                  {invoice.combinedPayment.payment_number}
                </dd>
              </>
            )}
            {invoice.combinedPayment?.reference_number && (
              <>
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="break-words text-right font-medium">
                  {invoice.combinedPayment.reference_number}
                </dd>
              </>
            )}
          </dl>
        </div>

        {/* Line Items */}
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead scope="col">Item</TableHead>
                <TableHead scope="col">SKU</TableHead>
                <TableHead scope="col" className="text-right">
                  Qty
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Unit Price
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[240px] whitespace-normal">
                    <div className="font-medium">{item.name}</div>
                    {item.variantName && (
                      <div className="text-xs text-muted-foreground">
                        {item.variantName}
                      </div>
                    )}
                    {item.description && (
                      <div className="text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.sku || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {item.unitPrice === null
                      ? "Unverified"
                      : formatCurrency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                    {getLineTotal(item) === null
                      ? "Unverified"
                      : formatCurrency(getLineTotal(item))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Notes & Financial Summary */}
        <div
          className={`flex flex-col gap-5 sm:flex-row ${
            invoice.notes ? "sm:justify-between" : "sm:justify-end"
          }`}
        >
          {invoice.notes && (
            <section className="max-w-sm space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {invoice.notes}
              </p>
            </section>
          )}

          <div className="w-full space-y-2.5 sm:max-w-xs">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">
                {subtotal === null ? "Unverified" : formatCurrency(subtotal)}
              </span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular-nums">
                  -{formatCurrency(invoice.discount)}
                </span>
              </div>
            )}
            {invoice.tax > 0 && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums">
                  {formatCurrency(invoice.tax)}
                </span>
              </div>
            )}
            {invoice.otherCharges > 0 && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Other Charges</span>
                <span className="tabular-nums">
                  {formatCurrency(invoice.otherCharges)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between gap-4 text-sm font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {total === null ? "Unverified" : formatCurrency(total)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="tabular-nums">
                {formatCurrency(invoice.amountPaid)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
              <span>Balance Due</span>
              <span
                className={`tabular-nums ${
                  balanceDue === 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : ""
                }`}
              >
                {balanceDue === null
                  ? "Unverified"
                  : formatCurrency(balanceDue)}
              </span>
            </div>
          </div>
        </div>

        <p className="border-t pt-3.5 text-center text-xs text-muted-foreground">
          Thank you for your business.
        </p>
      </div>

      {actionContainer === undefined ? (
        <CardFooter className="justify-end border-t-0 bg-transparent px-0 py-0">
          {pdfButton}
        </CardFooter>
      ) : (
        actionContainer && createPortal(pdfButton, actionContainer)
      )}
    </>
  );
}
