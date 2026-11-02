"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, LoaderCircle, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  description?: string;
  quantity: number;
  unitPrice: number | null;
};

type Invoice = {
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

// jsPDF's built-in Helvetica font may not render the Unicode peso sign (₱)
// correctly. Use ASCII-only currency text in the generated PDF to avoid
// character-spacing and table-overflow issues. The web page still uses ₱.
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

function statusBadgeVariant(status: string) {
  switch (status) {
    case "PAID":
    case "ISSUED":
      return "default" as const;
    case "PARTIALLY_PAID":
    case "DRAFT":
      return "secondary" as const;
    case "OVERDUE":
    case "VOID":
      return "destructive" as const;
    case "UNVERIFIED":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

export default function Invoice({ orderId }: { orderId: number }) {
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
      <p className="py-8 text-center text-muted-foreground">
        Loading invoice...
      </p>
    );
  }

  if (invoiceQuery.isError || !invoiceQuery.data) {
    return (
      <div role="alert" className="space-y-3 py-8 text-center">
        <p>Unable to load this invoice.</p>
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
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
    discount: invoiceQuery.data.discount,
    tax: invoiceQuery.data.tax,
    otherCharges: invoiceQuery.data.other_charges,
    amountPaid: invoiceQuery.data.amount_paid,
    notes: invoiceQuery.data.notes,
  };

  const subtotal = getInvoiceSubtotal(invoice);
  const total = getInvoiceTotal(invoice);
  const balanceDue = getBalanceDue(invoice);

  async function handleGeneratePdf() {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Keep text compact and consistent throughout the document.
      doc.setCharSpace(0);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const rightEdge = pageWidth - margin;

      // Company heading
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(company.name, margin, 22);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 90);
      doc.text(company.address, margin, 28);
      if (company.phone) doc.text(`Phone: ${company.phone}`, margin, 33);
      if (company.email) doc.text(`Email: ${company.email}`, margin, 38);

      // Invoice title and metadata
      doc.setTextColor(25, 25, 25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("INVOICE", rightEdge, 22, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Invoice No.: ${invoice.invoiceNumber}`, rightEdge, 29, {
        align: "right",
      });
      doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, rightEdge, 35, {
        align: "right",
      });
      doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, rightEdge, 41, {
        align: "right",
      });
      doc.text(`Status: ${invoice.status}`, rightEdge, 47, { align: "right" });

      // Divider
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, 54, rightEdge, 54);

      // Bill-to details
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text("BILL TO", margin, 63);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(
        invoice.customer.companyName || invoice.customer.name,
        margin,
        69,
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      let customerY = 74;
      if (invoice.customer.companyName) {
        doc.text(invoice.customer.name, margin, customerY);
        customerY += 5;
      }
      const addressLines = doc.splitTextToSize(invoice.customer.address, 85);
      doc.text(addressLines, margin, customerY);
      customerY += addressLines.length * 4.5;
      if (invoice.customer.email) {
        doc.text(invoice.customer.email, margin, customerY);
        customerY += 4.5;
      }
      if (invoice.customer.phone) {
        doc.text(invoice.customer.phone, margin, customerY);
      }

      // Payment details on the right
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("PAYMENT DETAILS", 120, 63);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Arrangement: ${invoice.paymentArrangement}`, 120, 70);
      doc.text(`Payment status: ${invoice.paymentStatus}`, 120, 76);
      doc.text(
        `Amount paid: ${formatPdfCurrency(invoice.amountPaid)}`,
        120,
        82,
      );
      doc.text(`Balance due: ${formatPdfCurrency(balanceDue)}`, 120, 88);

      const tableStartY = Math.max(customerY + 12, 102);
      autoTable(doc, {
        startY: tableStartY,
        margin: { left: margin, right: margin },
        head: [["Item", "Description", "Qty", "Unit Price", "Amount"]],
        body: invoice.items.map((item) => [
          item.name,
          item.description || "—",
          item.quantity.toLocaleString("en-PH"),
          formatPdfCurrency(item.unitPrice),
          formatPdfCurrency(getLineTotal(item)),
        ]),
        theme: "grid",
        headStyles: {
          fillColor: [35, 45, 60],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2.5,
          overflow: "ellipsize",
          textColor: [45, 45, 45],
          lineColor: [225, 225, 225],
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { cellWidth: 47 },
          1: { cellWidth: 35 },
          2: { halign: "right", cellWidth: 17 },
          3: { halign: "right", cellWidth: 35 },
          4: { halign: "right", cellWidth: 40 },
        },
      });

      // Totals are positioned after the generated table.
      const table = doc as jsPDF & { lastAutoTable?: { finalY: number } };
      let totalsY = (table.lastAutoTable?.finalY ?? tableStartY) + 10;

      if (totalsY > pageHeight - 55) {
        doc.addPage();
        totalsY = 24;
      }

      const labelX = rightEdge - 62;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Subtotal", labelX, totalsY);
      doc.text(formatPdfCurrency(subtotal), rightEdge, totalsY, {
        align: "right",
      });

      totalsY += 6;
      doc.text("Discount", labelX, totalsY);
      doc.text(`-${formatPdfCurrency(invoice.discount)}`, rightEdge, totalsY, {
        align: "right",
      });

      totalsY += 6;
      doc.text("Tax", labelX, totalsY);
      doc.text(formatPdfCurrency(invoice.tax), rightEdge, totalsY, {
        align: "right",
      });

      totalsY += 6;
      doc.text("Other charges", labelX, totalsY);
      doc.text(formatPdfCurrency(invoice.otherCharges), rightEdge, totalsY, {
        align: "right",
      });

      totalsY += 3;
      doc.setDrawColor(180, 180, 180);
      doc.line(labelX, totalsY, rightEdge, totalsY);
      totalsY += 7;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("TOTAL", labelX, totalsY);
      doc.text(formatPdfCurrency(total), rightEdge, totalsY, {
        align: "right",
      });

      totalsY += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Amount paid", labelX, totalsY);
      doc.text(formatPdfCurrency(invoice.amountPaid), rightEdge, totalsY, {
        align: "right",
      });

      totalsY += 7;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("BALANCE DUE", labelX, totalsY);
      doc.text(formatPdfCurrency(balanceDue), rightEdge, totalsY, {
        align: "right",
      });

      if (invoice.notes) {
        totalsY += 15;
        if (totalsY > pageHeight - 20) {
          doc.addPage();
          totalsY = 22;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Notes", margin, totalsY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(
          doc.splitTextToSize(invoice.notes, pageWidth - margin * 2),
          margin,
          totalsY + 5,
        );
      }

      // Footer on every page
      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(125, 125, 125);
        doc.text(
          `${invoice.invoiceNumber} • Generated by HYOps`,
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

  return (
    <>
      <Button
        type="button"
        onClick={() => void handleGeneratePdf()}
        disabled={isGeneratingPdf}
      >
        {isGeneratingPdf ? "Generating PDF…" : "Generate PDF"}
      </Button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {company.name}
          </p>
          <CardTitle className="text-3xl">Invoice</CardTitle>
          <p className="text-sm text-muted-foreground">{company.address}</p>
        </div>
        <div className="space-y-2 sm:text-right">
          <p className="text-lg font-semibold">{invoice.invoiceNumber}</p>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Badge variant={statusBadgeVariant(invoice.status)}>
              {invoice.status}
            </Badge>
            <Badge variant={statusBadgeVariant(invoice.paymentStatus)}>
              {invoice.paymentStatus.replaceAll("_", " ")}
            </Badge>
          </div>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Bill to
          </h2>
          <p className="font-semibold">
            {invoice.customer.companyName || invoice.customer.name}
          </p>
          {invoice.customer.companyName && <p>{invoice.customer.name}</p>}
          <p className="max-w-md text-sm text-muted-foreground">
            {invoice.customer.address}
          </p>
          {invoice.customer.email && (
            <p className="text-sm text-muted-foreground">
              {invoice.customer.email}
            </p>
          )}
          {invoice.customer.phone && (
            <p className="text-sm text-muted-foreground">
              {invoice.customer.phone}
            </p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-x-4 gap-y-3 md:justify-self-end">
          <span className="text-sm text-muted-foreground">Issue date</span>
          <span className="text-right text-sm font-medium">
            {formatDate(invoice.issueDate)}
          </span>
          {/* <span className="text-sm text-muted-foreground">Due date</span>
          <span className="text-right text-sm font-medium">
            {formatDate(invoice.dueDate)}
          </span> */}
          <span className="text-sm text-muted-foreground">Payment terms</span>
          <span className="text-right text-sm font-medium">
            {invoice.paymentArrangement.replaceAll("_", " ")}
          </span>
        </section>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.description || "—"}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">
                  {item.unitPrice === null
                    ? "Unverified"
                    : formatCurrency(item.unitPrice)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {getLineTotal(item) === null
                    ? "Unverified"
                    : formatCurrency(getLineTotal(item))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div className="max-w-sm space-y-2">
          <h2 className="text-sm font-semibold">Notes</h2>
          <p className="text-sm text-muted-foreground">
            {invoice.notes || "No additional notes."}
          </p>
        </div>

        <div className="w-full space-y-3 sm:max-w-xs">
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>
              {subtotal === null ? "Unverified" : formatCurrency(subtotal)}
            </span>
          </div>

          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Other charges</span>
            <span>{formatCurrency(invoice.otherCharges)}</span>
          </div>
          <Separator />
          <div className="flex justify-between gap-4 font-semibold">
            <span>Total</span>
            <span>{total === null ? "Unverified" : formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Amount paid</span>
            <span>{formatCurrency(invoice.amountPaid)}</span>
          </div>
          <div className="flex justify-between gap-4 text-lg font-semibold">
            <span>Balance due</span>
            <span>
              {balanceDue === null ? "Unverified" : formatCurrency(balanceDue)}
            </span>
          </div>
        </div>
      </div>

      <p className="border-t pt-4 text-center text-xs text-muted-foreground">
        Thank you for your business.
      </p>
    </>
  );
}
