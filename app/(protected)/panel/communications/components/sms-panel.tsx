"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { communicationRequest, normalizePhone, smsPreview, smsVariables, validPhone, type SmsStats, type SmsTemplate } from "@/lib/communications";
import { SendReview } from "./send-review";
import { RecipientCombobox } from "./recipient-combobox";

const selectClass = "h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-sm disabled:opacity-50";
const seen = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : "Not reported";
type Draft = { device_id: string; phone_number: string; template_id: number; variables: Record<string, string>; device: string; template: string; preview: string };

export function SmsPanel({ active }: { active: boolean }) {
  const cache = useQueryClient();
  const stats = useQuery({ queryKey: ["communications-sms", "stats"], queryFn: () => communicationRequest<SmsStats>("GET", "/api/sms/stats"), enabled: active, retry: 1, refetchInterval: active ? 30000 : false });
  const templates = useQuery({ queryKey: ["communications-sms", "templates"], queryFn: () => communicationRequest<{ success: true; templates: SmsTemplate[] }>("GET", "/api/sms/templates"), enabled: active, retry: 1 });
  const [deviceId, setDeviceId] = useState(""), [templateId, setTemplateId] = useState(""), [phone, setPhone] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Draft | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const sending = useRef(false);
  const devices = stats.data?.per_device.filter(device => device.is_active) ?? [];
  const available = templates.data?.templates.filter(template => template.is_active) ?? [];
  const template = available.find(item => String(item.id) === templateId), device = devices.find(item => item.device_id === deviceId);
  const names = template ? smsVariables(template) : [];
  const preview = template ? smsPreview(template, values) : "";
  const ready = Boolean(device && template && validPhone(phone) && names.every(name => typeof values[name] === "string" && values[name].trim()) && !stats.isError && !templates.isError);
  function openReview() {
    if (!ready || !device || !template) return;
    setError(""); setSuccess("");
    setReview({ device_id: device.device_id, device: device.device_name, phone_number: normalizePhone(phone), template_id: template.id, template: template.name, variables: Object.fromEntries(names.map(name => [name, values[name].trim()])), preview });
  }
  async function send() {
    if (!review || sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try {
      await communicationRequest("POST", "/api/sms/send-sms", { device_id: review.device_id, phone_number: review.phone_number, template_id: review.template_id, variables: review.variables });
      setSuccess(`SMS request accepted for ${review.phone_number}. Delivery is tracked by your SMS gateway.`);
      setReview(null); setPhone(""); setValues({});
      await cache.invalidateQueries({ queryKey: ["communications-sms"] });
    } catch (issue) { setError(issue instanceof Error ? issue.message : "SMS submission was not confirmed. Check your gateway before retrying."); }
    finally { setBusy(false); sending.current = false; }
  }
  return <div className="min-w-0 space-y-6">
    <section aria-label="SMS gateway overview" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">SMS gateway</h2><p className="text-sm text-muted-foreground">Activity reported by your SMS service.</p></div><Button variant="outline" size="sm" disabled={stats.isFetching || templates.isFetching} onClick={() => { void stats.refetch(); void templates.refetch(); }}>Refresh SMS</Button></div>
      {stats.isPending && <div role="status" aria-label="Loading SMS statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0,1,2,3].map(item => <Skeleton key={item} className="h-24 motion-reduce:animate-none" />)}</div>}
      {stats.isError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"><span>{stats.error.message}</span><Button variant="outline" size="sm" onClick={() => void stats.refetch()}>Retry SMS stats</Button></div>}
      {stats.data && <><dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([['Total messages', stats.data.overall.total], ['Sent', stats.data.overall.sent], ['Delivered', stats.data.overall.delivered], ['Failed', stats.data.overall.failed]] as const).map(([label, value]) => <div key={label} className="rounded-lg border p-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd></div>)}</dl>
        <p className="text-xs text-muted-foreground">Pending: {stats.data.overall.pending} / Processing: {stats.data.overall.processing} / Cancelled: {stats.data.overall.cancelled} / Active devices: {stats.data.active_devices}</p>
        <p className="text-sm text-muted-foreground">Today: {stats.data.today.total} total, {stats.data.today.sent} sent, {stats.data.today.failed} failed.</p></>}
    </section>
    {success && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">{success}</p>}
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <section className="min-w-0 rounded-xl border p-4 sm:p-5"><h2 className="text-lg font-semibold">Send SMS</h2><p className="mt-1 text-sm text-muted-foreground">Choose an active template and fill in its details.</p>
        {templates.isError && <div role="alert" className="mt-4 text-sm"><p>{templates.error.message}</p><Button className="mt-2" variant="outline" size="sm" onClick={() => void templates.refetch()}>Retry templates</Button></div>}
        <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); openReview(); }}>
          <label className="grid min-w-0 gap-2 text-sm font-medium">SMS device<select aria-label="SMS device" className={selectClass} value={deviceId} disabled={busy || !devices.length} onChange={event => setDeviceId(event.target.value)}><option value="">Select an active device</option>{devices.map(item => <option key={item.device_id} value={item.device_id}>{item.device_name}</option>)}</select></label>
          {stats.data && !devices.length && <p className="text-sm text-muted-foreground">No active devices are available. Check your SMS gateway.</p>}
          <label className="grid min-w-0 gap-2 text-sm font-medium">SMS template<select aria-label="SMS template" className={selectClass} value={templateId} disabled={busy || !available.length} onChange={event => { setTemplateId(event.target.value); setValues({}); }}><option value="">Select a template</option>{available.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {templates.isPending && <p role="status" className="text-sm text-muted-foreground">Loading templates...</p>}
          {templates.data && !available.length && <p className="text-sm text-muted-foreground">No active templates. Manage templates in your SMS gateway.</p>}
          <RecipientCombobox channel="phone" value={phone} onChange={setPhone} disabled={busy} />
          {phone && !validPhone(phone) && <p className="text-sm text-destructive">Enter 7 to 15 digits, with a country code when needed.</p>}
          {names.map(name => <label key={name} className="grid min-w-0 gap-2 break-words text-sm font-medium">{name}<Input className="h-11" value={typeof values[name] === "string" ? values[name] : ""} maxLength={1000} required readOnly={busy} onChange={event => setValues(current => ({ ...current, [name]: event.target.value }))} /></label>)}
          <Button type="submit" disabled={!ready || busy}>Review SMS</Button>
        </form>
      </section>
      <section className="min-w-0 rounded-xl border p-4 sm:p-5" aria-label="SMS message preview"><h2 className="text-lg font-semibold">Message preview</h2><p className="mt-1 text-sm text-muted-foreground">Fill every template field before sending.</p><div className="mt-5 whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-4 text-sm [overflow-wrap:anywhere]">{template ? preview : "Select a template to preview your SMS."}</div>{template && <p className="mt-3 text-xs text-muted-foreground">{preview.length} characters / Template: {template.name}</p>}
        <details className="mt-6 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Templates ({templates.data?.templates.length ?? 0})</summary><div className="mt-3 space-y-4">{templates.data?.templates.map(item => <div key={item.id} className="min-w-0 text-sm"><p className="font-medium">{item.name} / {item.is_active ? "Active" : "Inactive"}</p><p className="whitespace-pre-wrap break-words text-muted-foreground [overflow-wrap:anywhere]">{item.content}</p><p className="mt-1 text-xs text-muted-foreground">Used {item.usage_count} times</p></div>)}</div></details>
        <p className="mt-4 text-xs text-muted-foreground">Devices and templates are managed in your SMS gateway.</p>
      </section>
    </div>
    {stats.data && <div className="grid min-w-0 gap-6 xl:grid-cols-2"><section className="min-w-0"><h2 className="mb-3 text-base font-semibold">Recent SMS activity</h2><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{["Date", "Total", "Sent", "Failed"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>{stats.data.weekly_trend.slice().sort((a,b) => a.date.localeCompare(b.date)).slice(-7).map(item => <tr key={item.date} className="border-t"><td className="whitespace-nowrap px-3 py-2">{item.date}</td><td className="px-3 py-2">{item.total}</td><td className="px-3 py-2">{item.sent}</td><td className="px-3 py-2">{item.failed}</td></tr>)}</tbody></table>{!stats.data.weekly_trend.length && <p className="p-3 text-sm text-muted-foreground">No activity reported.</p>}</div></section>
      <section className="min-w-0"><h2 className="mb-3 text-base font-semibold">SMS devices</h2><div className="space-y-3">{stats.data.per_device.map(item => <div key={item.device_id} className="min-w-0 rounded-lg border p-3 text-sm"><p className="break-words font-medium">{item.device_name} / {item.is_active ? "Active" : "Inactive"}</p><p className="mt-1 text-xs text-muted-foreground">Last seen (Manila): {seen(item.last_seen)}</p><p className="mt-1 text-xs text-muted-foreground">{item.total_sms} total / {item.sent} sent / {item.failed} failed</p></div>)}{!stats.data.per_device.length && <p className="text-sm text-muted-foreground">No devices reported.</p>}</div></section></div>}
    {review && <SendReview channel="SMS" recipient={review.phone_number} description={`${review.device} / ${review.template}`} busy={busy} error={error} onClose={() => setReview(null)} onSend={() => void send()}><p className="whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-4 text-sm [overflow-wrap:anywhere]">{review.preview}</p></SendReview>}
  </div>;
}
