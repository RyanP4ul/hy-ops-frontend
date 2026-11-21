"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Eye, Mail, Send, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { communicationRequest } from "@/lib/communications";
import { SendReview } from "./send-review";
import { RecipientCombobox } from "./recipient-combobox";

type Draft = { to: string; subject: string; message: string };

export function EmailPanel() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const sending = useRef(false);

  const ready =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()) &&
    Boolean(subject.trim() && message.trim()) &&
    !/[\r\n]/.test(subject);

  async function send() {
    if (!review || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await communicationRequest("POST", "/api/email/send", review);
      setSuccess(`Email accepted for sending to ${review.to}.`);
      setReview(null);
      setTo("");
      setSubject("");
      setMessage("");
    } catch (issue) {
      setError(
        issue instanceof Error
          ? issue.message
          : "Email submission was not confirmed. Check the sender mailbox before retrying.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      {success && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200"
        >
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          <p className="min-w-0 break-words">{success}</p>
        </div>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        {/* Email Composer Card */}
        <section className="min-w-0 rounded-xl border bg-card p-4 shadow-xs sm:p-6">
          <div className="flex items-start justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                Send email
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Compose and dispatch a plain-text email from the HYOps workspace sender account.
              </p>
            </div>
            <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground sm:flex">
              <Mail className="size-4" aria-hidden="true" />
            </span>
          </div>

          <form
            className="mt-5 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!ready) return;
              setError("");
              setSuccess("");
              setReview({
                to: to.trim(),
                subject: subject.trim(),
                message,
              });
            }}
          >
            <RecipientCombobox
              channel="email"
              value={to}
              onChange={setTo}
              disabled={busy}
            />

            <div className="space-y-1.5">
              <label className="grid gap-1.5 text-sm font-medium">
                Subject
                <Input
                  className="h-10 bg-background"
                  value={subject}
                  placeholder="e.g., Order #1042 dispatch update"
                  maxLength={200}
                  required
                  readOnly={busy}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>
              <p className="text-right text-[11px] text-muted-foreground tabular-nums">
                {subject.length} / 200 characters
              </p>
            </div>

            <label className="grid gap-1.5 text-sm font-medium">
              Email message
              <Textarea
                aria-label="Email message"
                className="min-h-56 resize-y bg-background leading-relaxed"
                placeholder="Write your message here..."
                value={message}
                maxLength={20000}
                required
                readOnly={busy}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground tabular-nums">
                Plain-text email · {message.length.toLocaleString()} / 20,000 characters
              </p>
              <Button
                type="submit"
                className="cursor-pointer gap-2"
                disabled={!ready || busy}
              >
                <Send className="size-4" aria-hidden="true" />
                Review email
              </Button>
            </div>
          </form>
        </section>

        {/* Live Envelope Preview Card */}
        <section
          aria-label="Email live preview"
          className="flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-xs sm:p-6"
        >
          <div className="flex items-start justify-between gap-2 border-b pb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                Envelope preview
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Read-only preview of your outgoing plain-text message.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 gap-1 text-[11px]">
              <Eye className="size-3" aria-hidden="true" />
              Plain text
            </Badge>
          </div>

          <div className="mt-4 flex flex-1 flex-col overflow-hidden rounded-xl border bg-muted/25">
            <div className="divide-y border-b bg-muted/40 text-xs">
              <div className="flex items-center gap-2 px-3.5 py-2.5">
                <UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="shrink-0 text-muted-foreground">To:</span>
                <span className="min-w-0 truncate font-medium text-foreground">
                  {to.trim() || "No recipient selected"}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2.5">
                <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="shrink-0 text-muted-foreground">Subject:</span>
                <span className="min-w-0 truncate font-medium text-foreground">
                  {subject.trim() || "No subject yet"}
                </span>
              </div>
            </div>

            <div className="flex-1 p-4">
              {message.trim() ? (
                <p className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                  {message}
                </p>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Start typing your message on the left to preview the outgoing email.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {review && (
        <SendReview
          channel="email"
          recipient={review.to}
          description={review.subject}
          busy={busy}
          error={error}
          onClose={() => setReview(null)}
          onSend={() => void send()}
        >
          <p className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed [overflow-wrap:anywhere]">
            {review.message}
          </p>
        </SendReview>
      )}
    </div>
  );
}
