"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { communicationRequest } from "@/lib/communications";
import { SendReview } from "./send-review";
import { RecipientCombobox } from "./recipient-combobox";

type Draft = { to: string; subject: string; message: string };
export function EmailPanel() {
  const [to, setTo] = useState(""), [subject, setSubject] = useState(""), [message, setMessage] = useState("");
  const [review, setReview] = useState<Draft | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const sending = useRef(false);
  const ready = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()) && Boolean(subject.trim() && message.trim()) && !/[\r\n]/.test(subject);
  async function send() {
    if (!review || sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try {
      await communicationRequest("POST", "/api/email/send", review);
      setSuccess(`Email accepted for sending to ${review.to}.`); setReview(null); setTo(""); setSubject(""); setMessage("");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Email submission was not confirmed. Check the sender mailbox before retrying."); }
    finally { sending.current = false; setBusy(false); }
  }
  return <div className="max-w-3xl space-y-5">
    <div><h2 className="text-lg font-semibold">Send email</h2><p className="mt-1 text-sm text-muted-foreground">Send a message from the email account configured for HYOps.</p></div>
    {success && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">{success}</p>}
    <form className="space-y-5 rounded-xl border p-4 sm:p-5" onSubmit={event => { event.preventDefault(); if (!ready) return; setError(""); setSuccess(""); setReview({ to: to.trim(), subject: subject.trim(), message }); }}>
      <RecipientCombobox channel="email" value={to} onChange={setTo} disabled={busy} />
      <label className="grid gap-2 text-sm font-medium">Subject<Input className="h-11" value={subject} maxLength={200} required readOnly={busy} onChange={event => setSubject(event.target.value)} /></label>
      <label className="grid gap-2 text-sm font-medium">Email message<Textarea aria-label="Email message" className="min-h-56 resize-y" value={message} maxLength={20000} required readOnly={busy} onChange={event => setMessage(event.target.value)} /></label>
      <div className="flex flex-wrap items-center justify-between gap-3"><Button type="submit" disabled={!ready || busy}>Review email</Button><p className="text-xs text-muted-foreground">Plain-text email / {message.length.toLocaleString()} characters</p></div>
    </form>
    {review && <SendReview channel="email" recipient={review.to} description={review.subject} busy={busy} error={error} onClose={() => setReview(null)} onSend={() => void send()}><p className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-4 text-sm [overflow-wrap:anywhere]">{review.message}</p></SendReview>}
  </div>;
}
