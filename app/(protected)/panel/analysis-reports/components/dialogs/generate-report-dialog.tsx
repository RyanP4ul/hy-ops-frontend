"use client";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadReport, getReport } from "../../api/client";
import { REPORT_TYPES, type ExportFormat, type Filters, type PreviewResponse, type ReportType } from "../../api/contract";
import { peso } from "../../lib/format";

const FORMATS: { value: ExportFormat; label: string }[] = [{ value: "csv", label: "CSV" }, { value: "xlsx", label: "XLSX (Excel)" }];
const show = (s: PreviewResponse["summary"][number]) => s.value === null
  ? "Unverified"
  : s.format === "currency"
    ? peso(s.value)
    : s.format === "percent"
      ? `${s.value.toFixed(1)}%`
      : String(s.value);

interface Props { open: boolean; onClose: () => void; filters: Filters; lowStockThreshold: number }

type Step = { name: "form" } | { name: "loading" } | { name: "preview"; data: PreviewResponse };

export function GenerateReportDialog({ open, onClose, filters, lowStockThreshold }: Props) {
  const [type, setType] = useState<ReportType>("Sales");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [step, setStep] = useState<Step>({ name: "form" });
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);
  const extra = { type, threshold: String(lowStockThreshold) };

  const close = () => { setStep({ name: "form" }); setMessage(null); onClose(); };

  const preview = async () => {
    setMessage(null);
    setStep({ name: "loading" });
    try {
      setStep({ name: "preview", data: await getReport<PreviewResponse>("/preview", filters, extra) });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {step.name === "form" && (<>
          <DialogHeader><DialogTitle>Generate report</DialogTitle><DialogDescription>Uses the date range and filters currently applied to this page.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
              <SelectTrigger aria-label="Report type"><SelectValue /></SelectTrigger>
              <SelectContent>{REPORT_TYPES.map((t) => <SelectItem key={t} value={t}>{t} report</SelectItem>)}</SelectContent>
            </Select>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger aria-label="Export format"><SelectValue /></SelectTrigger>
              <SelectContent>{FORMATS.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">PDF export isn&apos;t available yet.</p>
            {message && <Alert variant={message.error ? "destructive" : "default"}><AlertDescription>{message.text}</AlertDescription></Alert>}
          </div>
          <DialogFooter><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={preview}>Generate preview</Button></DialogFooter>
        </>)}

        {step.name === "loading" && (<><DialogHeader><DialogTitle>Preparing preview</DialogTitle></DialogHeader><Skeleton className="h-32 w-full" /></>)}

        {step.name === "preview" && (<>
          <DialogHeader><DialogTitle>HY Company — {type} report</DialogTitle><DialogDescription>Preview</DialogDescription></DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Period: {step.data.metadata.from} to {step.data.metadata.to} (Asia/Manila) · Format: {format.toUpperCase()}</p>
            <p>Generated: {new Date(step.data.metadata.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Asia/Manila)</p>
            <p>Filters: {step.data.metadata.filters.join("; ") || "All records in scope"}</p>
            <p className="text-xs text-muted-foreground">{step.data.metadata.basis}</p>
            <p className="text-xs text-muted-foreground">Amounts in PHP. CSV includes report details before the column headings; Excel includes a Report details sheet. Preview and download each read current records, so intervening changes can alter the result.</p>
            <Separator />
            <div className="grid grid-cols-3 gap-2">
              {step.data.summary.map((s) => <div key={s.label}><div className="text-xs text-muted-foreground">{s.label}</div><div className="font-semibold">{show(s)}</div></div>)}
            </div>
            <Separator />
            <p>Rows included: {step.data.rowCount}</p>
            {message && <Alert variant={message.error ? "destructive" : "default"}><AlertDescription>{message.text}</AlertDescription></Alert>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setStep({ name: "form" }); setMessage(null); }}>Back</Button>
            <Button onClick={exportFile} disabled={exporting}>{exporting ? "Exporting…" : `Export ${format.toUpperCase()}`}</Button>
            <Button variant="ghost" onClick={close}>Close</Button>
          </DialogFooter>
        </>)}
      </DialogContent>
    </Dialog>
  );
}
