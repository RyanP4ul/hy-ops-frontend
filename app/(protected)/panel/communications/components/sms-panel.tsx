"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  MessageSquare,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  communicationRequest,
  normalizePhone,
  smsPreview,
  smsVariables,
  validPhone,
  type SmsStats,
  type SmsTemplate,
} from "@/lib/communications";
import { cn } from "@/lib/utils";
import { SendReview } from "./send-review";
import { RecipientCombobox } from "./recipient-combobox";

const selectClass =
  "h-10 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const seen = (value: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not reported";

function estimateSegments(length: number) {
  if (length <= 0) return 0;
  return length <= 160 ? 1 : Math.ceil(length / 153);
}

type Draft = {
  device_id: string;
  phone_number: string;
  template_id: number;
  variables: Record<string, string>;
  device: string;
  template: string;
  preview: string;
};

export function SmsPanel({ active }: { active: boolean }) {
  const cache = useQueryClient();
  const stats = useQuery({
    queryKey: ["communications-sms", "stats"],
    queryFn: () => communicationRequest<SmsStats>("GET", "/api/sms/stats"),
    enabled: active,
    retry: 1,
    refetchInterval: active ? 30000 : false,
  });
  const templates = useQuery({
    queryKey: ["communications-sms", "templates"],
    queryFn: () =>
      communicationRequest<{ success: true; templates: SmsTemplate[] }>(
        "GET",
        "/api/sms/templates",
      ),
    enabled: active,
    retry: 1,
  });

  const [deviceId, setDeviceId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [phone, setPhone] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const sending = useRef(false);

  const devices = stats.data?.per_device.filter((device) => device.is_active) ?? [];
  const available = templates.data?.templates.filter((template) => template.is_active) ?? [];
  const template = available.find((item) => String(item.id) === templateId);
  const device = devices.find((item) => item.device_id === deviceId);
  const names = template ? smsVariables(template) : [];
  const filledVariables = names.filter(
    (name) => typeof values[name] === "string" && values[name].trim().length > 0,
  ).length;
  const preview = template ? smsPreview(template, values) : "";
  const segments = estimateSegments(preview.length);
  const ready = Boolean(
    device &&
      template &&
      validPhone(phone) &&
      names.every((name) => typeof values[name] === "string" && values[name].trim()) &&
      !stats.isError &&
      !templates.isError,
  );

  function openReview() {
    if (!ready || !device || !template) return;
    setError("");
    setSuccess("");
    setReview({
      device_id: device.device_id,
      device: device.device_name,
      phone_number: normalizePhone(phone),
      template_id: template.id,
      template: template.name,
      variables: Object.fromEntries(names.map((name) => [name, values[name].trim()])),
      preview,
    });
  }

  async function send() {
    if (!review || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await communicationRequest("POST", "/api/sms/send-sms", {
        device_id: review.device_id,
        phone_number: review.phone_number,
        template_id: review.template_id,
        variables: review.variables,
      });
      setSuccess(
        `SMS request accepted for ${review.phone_number}. Delivery is tracked by your SMS gateway.`,
      );
      setReview(null);
      setPhone("");
      setValues({});
      await cache.invalidateQueries({ queryKey: ["communications-sms"] });
    } catch (issue) {
      setError(
        issue instanceof Error
          ? issue.message
          : "SMS submission was not confirmed. Check your gateway before retrying.",
      );
    } finally {
      setBusy(false);
      sending.current = false;
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* SMS Gateway Overview */}
      <section aria-label="SMS gateway overview" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight">SMS gateway</h2>
                {stats.data && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1.5 text-xs font-medium",
                      stats.data.active_devices > 0
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        stats.data.active_devices > 0 ? "bg-emerald-500" : "bg-amber-500",
                      )}
                    />
                    {stats.data.active_devices} active device
                    {stats.data.active_devices === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Live activity and queue status reported by your connected SMS gateway.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-1.5"
            disabled={stats.isFetching || templates.isFetching}
            onClick={() => {
              void stats.refetch();
              void templates.refetch();
            }}
          >
            <RefreshCw
              className={cn(
                "size-3.5",
                (stats.isFetching || templates.isFetching) &&
                  "animate-spin motion-reduce:animate-none",
              )}
              aria-hidden="true"
            />
            Refresh SMS
          </Button>
        </div>

        {stats.isPending && (
          <div
            role="status"
            aria-label="Loading SMS statistics"
            className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card sm:grid-cols-4"
          >
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="space-y-2.5 border-b border-r p-4 sm:border-b-0 last:border-r-0"
              >
                <Skeleton className="h-3.5 w-20 motion-reduce:animate-none" />
                <Skeleton className="h-7 w-14 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        )}

        {stats.isError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <div className="flex min-w-0 items-center gap-2">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span className="break-words">{stats.error.message}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => void stats.refetch()}
            >
              Retry SMS stats
            </Button>
          </div>
        )}

        {stats.data && (
          <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <dl className="grid grid-cols-2 sm:grid-cols-4">
              {(
                [
                  {
                    label: "Total messages",
                    value: stats.data.overall.total,
                    tone: "text-foreground",
                  },
                  {
                    label: "Sent",
                    value: stats.data.overall.sent,
                    tone: "text-blue-700 dark:text-blue-400",
                  },
                  {
                    label: "Delivered",
                    value: stats.data.overall.delivered,
                    tone: "text-emerald-700 dark:text-emerald-400",
                  },
                  {
                    label: "Failed",
                    value: stats.data.overall.failed,
                    tone:
                      stats.data.overall.failed > 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                  },
                ] as const
              ).map((metric, idx) => (
                <div
                  key={metric.label}
                  className={cn(
                    "p-4",
                    idx < 2 && "border-b sm:border-b-0",
                    idx % 2 === 0 && "border-r",
                    idx < 3 && "sm:border-r",
                  )}
                >
                  <dt className="text-xs font-medium text-muted-foreground">
                    {metric.label}
                  </dt>
                  <dd
                    className={cn(
                      "mt-1.5 text-2xl font-semibold tracking-tight tabular-nums",
                      metric.tone,
                    )}
                  >
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/25 px-4 py-2.5 text-xs text-muted-foreground">
              <p className="tabular-nums">
                Pending:{" "}
                <strong className="font-medium text-foreground">
                  {stats.data.overall.pending}
                </strong>{" "}
                · Processing:{" "}
                <strong className="font-medium text-foreground">
                  {stats.data.overall.processing}
                </strong>{" "}
                · Cancelled:{" "}
                <strong className="font-medium text-foreground">
                  {stats.data.overall.cancelled}
                </strong>
              </p>
              <p className="tabular-nums">
                Today:{" "}
                <strong className="font-medium text-foreground">
                  {stats.data.today.total}
                </strong>{" "}
                total,{" "}
                <strong className="font-medium text-foreground">
                  {stats.data.today.sent}
                </strong>{" "}
                sent,{" "}
                <strong
                  className={cn(
                    "font-medium",
                    stats.data.today.failed > 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {stats.data.today.failed}
                </strong>{" "}
                failed
              </p>
            </div>
          </div>
        )}
      </section>

      {success && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <p className="min-w-0 break-words">{success}</p>
        </div>
      )}

      {/* Main Composer & Live Preview Workspace */}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {/* Composer Card */}
        <section className="min-w-0 rounded-xl border bg-card p-4 shadow-xs sm:p-6">
          <div className="flex items-start justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">Send SMS</h2>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Select an active gateway device, choose a template, and complete the recipient details.
              </p>
            </div>
            <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground sm:flex">
              <MessageSquare className="size-4" aria-hidden="true" />
            </span>
          </div>

          {templates.isError && (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <p className="min-w-0 break-words">{templates.error.message}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => void templates.refetch()}
              >
                Retry templates
              </Button>
            </div>
          )}

          <form
            className="mt-5 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              openReview();
            }}
          >
            {/* Device & Template Row */}
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                  SMS device
                  <div className="relative">
                    <select
                      aria-label="SMS device"
                      className={selectClass}
                      value={deviceId}
                      disabled={busy || !devices.length}
                      onChange={(event) => setDeviceId(event.target.value)}
                    >
                      <option value="">Select an active device</option>
                      {devices.map((item) => (
                        <option key={item.device_id} value={item.device_id}>
                          {item.device_name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                </label>
                {stats.data && !devices.length && (
                  <p className="text-xs text-muted-foreground">
                    No active devices are available. Check your SMS gateway.
                  </p>
                )}
              </div>

              <div className="min-w-0 space-y-1.5">
                <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                  SMS template
                  <div className="relative">
                    <select
                      aria-label="SMS template"
                      className={selectClass}
                      value={templateId}
                      disabled={busy || !available.length}
                      onChange={(event) => {
                        setTemplateId(event.target.value);
                        setValues({});
                      }}
                    >
                      <option value="">Select a template</option>
                      {available.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                </label>
                {templates.isPending && (
                  <p role="status" className="text-xs text-muted-foreground">
                    Loading templates...
                  </p>
                )}
                {templates.data && !available.length && (
                  <p className="text-xs text-muted-foreground">
                    No active templates. Manage templates in your SMS gateway.
                  </p>
                )}
              </div>
            </div>

            {/* Recipient Combobox */}
            <div className="space-y-1.5">
              <RecipientCombobox
                channel="phone"
                value={phone}
                onChange={setPhone}
                disabled={busy}
              />
              {phone && !validPhone(phone) && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                  Enter 7 to 15 digits, with a country code when needed.
                </p>
              )}
            </div>

            {/* Dynamic Template Variables */}
            {names.length > 0 && (
              <div className="min-w-0 space-y-3 rounded-xl border bg-muted/25 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    Template variables
                  </span>
                  <Badge variant="secondary" className="text-[11px] tabular-nums">
                    {filledVariables} / {names.length} filled
                  </Badge>
                </div>
                <div className="grid min-w-0 gap-3.5 sm:grid-cols-2">
                  {names.map((name) => (
                    <label
                      key={name}
                      className="grid min-w-0 gap-1.5 break-words text-sm font-medium"
                    >
                      {name}
                      <Input
                        className="h-10 bg-background"
                        value={typeof values[name] === "string" ? values[name] : ""}
                        placeholder={`Enter ${name}`}
                        maxLength={1000}
                        required
                        readOnly={busy}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [name]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                {ready
                  ? "Ready to review before dispatching."
                  : "Complete all required fields to review your SMS."}
              </p>
              <Button
                type="submit"
                className="cursor-pointer gap-2"
                disabled={!ready || busy}
              >
                <Send className="size-4" aria-hidden="true" />
                Review SMS
              </Button>
            </div>
          </form>
        </section>

        {/* Live Preview & Template Library Card */}
        <section
          className="flex min-w-0 flex-col justify-between rounded-xl border bg-card p-4 shadow-xs sm:p-6"
          aria-label="SMS message preview"
        >
          <div className="min-w-0 space-y-4">
            <div className="flex items-start justify-between gap-2 border-b pb-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                  Message preview
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                  Live rendering of how your recipient will see this message.
                </p>
              </div>
              {template && (
                <Badge variant="outline" className="shrink-0 font-mono text-[11px] tabular-nums">
                  {segments} seg · {preview.length} ch
                </Badge>
              )}
            </div>

            {/* Simulated Device Preview Shell */}
            <div className="overflow-hidden rounded-xl border bg-muted/30">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-3.5 py-2 text-xs text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
                  <Smartphone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{device ? device.device_name : "No device selected"}</span>
                </span>
                <span className="truncate font-mono text-[11px]">
                  {phone.trim() ? normalizePhone(phone) : "Recipient"}
                </span>
              </div>

              <div className="p-4">
                <div
                  className={cn(
                    "whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm border p-3.5 text-sm leading-relaxed [overflow-wrap:anywhere]",
                    template
                      ? "bg-background text-foreground shadow-2xs"
                      : "border-dashed bg-transparent text-muted-foreground",
                  )}
                >
                  {template ? preview : "Select a template to preview your SMS."}
                </div>

                {template && (
                  <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Template: {template.name}</span>
                    <span className="tabular-nums">
                      {preview.length} characters · {segments} SMS segment
                      {segments === 1 ? "" : "s"}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3 border-t pt-4">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50">
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                  Templates ({templates.data?.templates.length ?? 0})
                </span>
                <ChevronDown
                  className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="mt-3 max-h-64 space-y-2.5 overflow-y-auto pr-1">
                {templates.data?.templates.map((item) => (
                  <div
                    key={item.id}
                    className="min-w-0 rounded-lg border bg-muted/20 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <Badge
                        variant={item.is_active ? "secondary" : "outline"}
                        className={cn(
                          "text-[11px]",
                          item.is_active
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                      {item.content}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                      Used {item.usage_count} {item.usage_count === 1 ? "time" : "times"}
                    </p>
                  </div>
                ))}
              </div>
            </details>
            <p className="px-2 text-xs text-muted-foreground">
              Devices and templates are managed in your SMS gateway.
            </p>
          </div>
        </section>
      </div>

      {/* Bottom Telemetry: Recent Activity & Connected Devices */}
      {stats.data && (
        <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          <section className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold sm:text-base">Recent SMS activity</h2>
              </div>
              <span className="text-xs text-muted-foreground">Last 7 days</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      Total
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      Sent
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      Failed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.data.weekly_trend
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .slice(-7)
                    .map((item) => (
                      <tr
                        key={item.date}
                        className="transition-colors hover:bg-muted/25"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-foreground">
                          {item.date}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          {item.total}
                        </td>
                        <td className="px-4 py-2.5 text-right text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {item.sent}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-2.5 text-right tabular-nums",
                            item.failed > 0
                              ? "font-medium text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.failed}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!stats.data.weekly_trend.length && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No activity reported.
                </p>
              )}
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2">
                <Smartphone className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold sm:text-base">SMS devices</h2>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {stats.data.per_device.length} registered
              </span>
            </div>
            <div className="divide-y p-2 sm:p-3">
              {stats.data.per_device.map((item) => (
                <div
                  key={item.device_id}
                  className="min-w-0 space-y-2 rounded-lg p-3 transition-colors hover:bg-muted/25"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="break-words text-sm font-medium text-foreground">
                      {item.device_name}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1.5 text-[11px]",
                        item.is_active
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 rounded-full",
                          item.is_active ? "bg-emerald-500" : "bg-muted-foreground/50",
                        )}
                      />
                      {item.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3 shrink-0" aria-hidden="true" />
                      Last seen (Manila): {seen(item.last_seen)}
                    </span>
                    <span className="tabular-nums">
                      {item.total_sms} total · {item.sent} sent · {item.failed} failed
                    </span>
                  </div>
                </div>
              ))}
              {!stats.data.per_device.length && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No devices reported.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {review && (
        <SendReview
          channel="SMS"
          recipient={review.phone_number}
          description={`${review.device} / ${review.template}`}
          busy={busy}
          error={error}
          onClose={() => setReview(null)}
          onSend={() => void send()}
        >
          <p className="whitespace-pre-wrap break-words rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed [overflow-wrap:anywhere]">
            {review.preview}
          </p>
        </SendReview>
      )}
    </div>
  );
}
