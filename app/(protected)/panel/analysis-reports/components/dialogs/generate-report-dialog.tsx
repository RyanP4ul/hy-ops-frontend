"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Info,
  Loader2,
  Table2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { downloadReport, getReport } from "../../api/client";
import {
  ARRAY_FILTER_KEYS,
  REPORT_TYPES,
  type ExportFormat,
  type Filters,
  type PreviewResponse,
  type ReportType,
} from "../../api/contract";
import { PRESETS } from "../../constants";
import { peso } from "../../lib/format";

const FORMATS: { value: ExportFormat; label: string; detail: string }[] = [
  {
    value: "csv",
    label: "CSV",
    detail: "Lightweight comma-separated file with report details before column headings.",
  },
  {
    value: "xlsx",
    label: "XLSX (Excel)",
    detail: "Formatted spreadsheet workbook with a dedicated Report details sheet.",
  },
];

const REPORT_DESCRIPTIONS: Record<ReportType, string> = {
  Sales: "Order revenue, unit volumes, product and warehouse breakdowns for the selected period.",
  Inventory: "Current stock quantities, reservations, availability, and low-stock thresholds.",
  Payment: "Collected receipts, refunds, net cashflow, and outstanding balances.",
  Delivery: "Dispatch completion counts, delivery types, vehicle performance, and failure reasons.",
  Customer: "Customer order frequency, sales volume, paid totals, and open account balances.",
};

const show = (s: PreviewResponse["summary"][number]) =>
  s.value === null
    ? "Unverified"
    : s.format === "currency"
      ? peso(s.value)
      : s.format === "percent"
        ? `${s.value.toFixed(1)}%`
        : s.value.toLocaleString();

function describeDateScope(filters: Filters) {
  if (filters.preset === "custom") {
    if (filters.from && filters.to) return `${filters.from} to ${filters.to}`;
    if (filters.from) return `From ${filters.from}`;
    return "Custom range";
  }
  return PRESETS.find(([key]) => key === filters.preset)?.[1] ?? filters.preset;
}

function countActiveFilters(filters: Filters) {
  let count = filters.overdueOnly ? 1 : 0;
  for (const key of ARRAY_FILTER_KEYS) {
    count += filters[key].length;
  }
  return count;
}

interface Props {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  lowStockThreshold: number;
}

type Step =
  | { name: "form" }
  | { name: "loading" }
  | { name: "preview"; data: PreviewResponse };

function StepIndicator({ active }: { active: 1 | 2 }) {
  return (
    <nav aria-label="Report generation steps" className="pt-1">
      <ol className="grid grid-cols-2 gap-2 text-xs">
        <li
          aria-current={active === 1 ? "step" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 font-medium transition-colors",
            active === 1
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "border-border bg-muted/25 text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
              active === 1
                ? "bg-primary text-primary-foreground"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
            )}
          >
            {active === 1 ? "1" : "✓"}
          </span>
          <span className="truncate">Configure</span>
        </li>
        <li
          aria-current={active === 2 ? "step" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 font-medium transition-colors",
            active === 2
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "border-border bg-muted/25 text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
              active === 2
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            2
          </span>
          <span className="truncate">Preview &amp; export</span>
        </li>
      </ol>
    </nav>
  );
}

export function GenerateReportDialog({
  open,
  onClose,
  filters,
  lowStockThreshold,
}: Props) {
  const [type, setType] = useState<ReportType>("Sales");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [step, setStep] = useState<Step>({ name: "form" });
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);

  const extra = { type, threshold: String(lowStockThreshold) };
  const activeFilterCount = countActiveFilters(filters);
  const selectedFormat = FORMATS.find((item) => item.value === format) ?? FORMATS[0];

  const close = () => {
    setStep({ name: "form" });
    setMessage(null);
    onClose();
  };

  const preview = async () => {
    setMessage(null);
    setStep({ name: "loading" });
    try {
      setStep({
        name: "preview",
        data: await getReport<PreviewResponse>("/preview", filters, extra),
      });
    } catch (e) {
      setStep({ name: "form" });
      setMessage({ text: (e as Error).message, error: true });
    }
  };

  const exportFile = async () => {
    setExporting(true);
    try {
      const name = await downloadReport("/export", filters, { ...extra, format });
      setMessage({ text: `Downloaded ${name}`, error: false });
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto p-5 sm:max-w-xl sm:p-6">
        {step.name === "form" && (
          <>
            <DialogHeader className="gap-1.5 pr-8">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-foreground">
                  <FileSpreadsheet className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
                    Generate report
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Uses the date range and filters currently applied to Analysis &amp; Reports.
                  </DialogDescription>
                </div>
              </div>
              <StepIndicator active={1} />
            </DialogHeader>

            <div className="space-y-4">
              {/* Current Page Scope Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/25 px-3.5 py-2.5 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Scope: {describeDateScope(filters)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Filter className="size-3.5" aria-hidden="true" />
                  {activeFilterCount > 0
                    ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                    : "No extra filters"}
                </span>
              </div>

              {/* Report Type Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="generate-report-type"
                  className="block text-sm font-medium text-foreground"
                >
                  Report type
                </label>
                <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
                  <SelectTrigger
                    id="generate-report-type"
                    aria-label="Report type"
                    className="h-10 w-full cursor-pointer bg-background"
                  >
                    <SelectValue>{type} report</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="cursor-pointer">
                        {t} report
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {REPORT_DESCRIPTIONS[type]}
                </p>
              </div>

              {/* Export Format Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="generate-export-format"
                  className="block text-sm font-medium text-foreground"
                >
                  Export format
                </label>
                <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                  <SelectTrigger
                    id="generate-export-format"
                    aria-label="Export format"
                    className="h-10 w-full cursor-pointer bg-background"
                  >
                    <SelectValue>{selectedFormat.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((x) => (
                      <SelectItem key={x.value} value={x.value} className="cursor-pointer">
                        {x.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {selectedFormat.detail}
                </p>
              </div>

              <div className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Currency values are formatted in PHP (Asia/Manila). PDF export isn&apos;t available yet.
                </span>
              </div>

              {message && (
                <Alert variant={message.error ? "destructive" : "default"}>
                  <AlertCircle className="size-4" aria-hidden="true" />
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={close}
              >
                Cancel
              </Button>
              <Button type="button" className="cursor-pointer gap-2" onClick={preview}>
                <FileText className="size-4" aria-hidden="true" />
                Generate preview
              </Button>
            </DialogFooter>
          </>
        )}

        {step.name === "loading" && (
          <>
            <DialogHeader className="gap-1.5 pr-8">
              <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <Loader2
                  className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Preparing preview
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Calculating summary metrics and row counts for {type} report ({format.toUpperCase()})…
              </DialogDescription>
              <StepIndicator active={2} />
            </DialogHeader>
            <div role="status" aria-label="Loading report preview" className="space-y-4 py-1">
              <div className="space-y-2 rounded-xl border bg-muted/25 p-3.5">
                <Skeleton className="h-3.5 w-2/3 motion-reduce:animate-none" />
                <Skeleton className="h-3.5 w-1/2 motion-reduce:animate-none" />
                <Skeleton className="h-3.5 w-3/4 motion-reduce:animate-none" />
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="space-y-2 rounded-xl border p-3">
                    <Skeleton className="h-3 w-20 motion-reduce:animate-none" />
                    <Skeleton className="h-6 w-24 motion-reduce:animate-none" />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {step.name === "preview" && (
          <>
            <DialogHeader className="gap-1.5 pr-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
                    HY Company — {type} report
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Preview summary before downloading your {format.toUpperCase()} file.
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="secondary" className="font-mono text-[11px] uppercase">
                    {format}
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-[11px] tabular-nums">
                    <Table2 className="size-3" aria-hidden="true" />
                    <span>Rows included: {step.data.rowCount}</span>
                  </Badge>
                </div>
              </div>
              <StepIndicator active={2} />
            </DialogHeader>

            <div className="space-y-4 text-sm">
              {/* Metadata Card */}
              <div className="divide-y rounded-xl border bg-muted/25 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
                    Period
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {step.data.metadata.from} to {step.data.metadata.to} (Asia/Manila)
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                    Generated
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {new Date(step.data.metadata.generatedAt).toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                    })}{" "}
                    (Asia/Manila)
                  </span>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-2 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Filter className="size-3.5 shrink-0" aria-hidden="true" />
                    Filters
                  </span>
                  <span className="max-w-sm break-words text-right font-medium text-foreground">
                    {step.data.metadata.filters.join("; ") || "All records in scope"}
                  </span>
                </div>
              </div>

              {/* Summary Metrics Grid */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Report summary
                </p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {step.data.summary.map((s) => {
                    const display = show(s);
                    const unverified = s.value === null;
                    return (
                      <div
                        key={s.label}
                        className={cn(
                          "rounded-xl border bg-card p-3",
                          unverified && "border-amber-500/40 bg-amber-500/[0.06]",
                        )}
                      >
                        <div className="text-[11px] font-medium text-muted-foreground">
                          {s.label}
                        </div>
                        <div
                          className={cn(
                            "mt-1 break-words text-base font-semibold tracking-tight tabular-nums",
                            unverified
                              ? "text-amber-800 dark:text-amber-300"
                              : "text-foreground",
                          )}
                        >
                          {display}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Basis & File Notes */}
              <div className="space-y-1.5 rounded-xl border bg-muted/20 p-3.5 text-xs leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground/90">{step.data.metadata.basis}</p>
                <p>
                  Amounts in PHP. CSV includes report details before the column headings; Excel
                  includes a Report details sheet. Preview and download each read current records,
                  so intervening changes can alter the result.
                </p>
              </div>

              {message && (
                <Alert
                  variant={message.error ? "destructive" : "default"}
                  className={cn(
                    !message.error &&
                      "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
                  )}
                >
                  {message.error ? (
                    <AlertCircle className="size-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle2
                      className="size-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                  )}
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6 items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer gap-1.5"
                onClick={() => {
                  setStep({ name: "form" });
                  setMessage(null);
                }}
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Back
              </Button>
              <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  className="cursor-pointer"
                  onClick={close}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  className="cursor-pointer gap-2"
                  onClick={exportFile}
                  disabled={exporting}
                >
                  {exporting ? (
                    <>
                      <Loader2
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      Exporting…
                    </>
                  ) : (
                    <>
                      <Download className="size-4" aria-hidden="true" />
                      {`Export ${format.toUpperCase()}`}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
