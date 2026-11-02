"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { request } from "@/components/http";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SendEmailResult = {
  message?: string;
};

export default function EmailPage() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!to.trim() || !subject.trim() || !message.trim()) {
      toast.error("Recipient, subject, and message are required.");
      return;
    }

    setSending(true);

    try {
      const response = await request("POST", "/api/email/send", {
        to: to.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      const result = (await response.json().catch(() => ({}))) as SendEmailResult;

      if (!response.ok) {
        toast.error(result.message || "Unable to send email.");
        return;
      }

      toast.success(result.message || "Email sent successfully.");
      setTo("");
      setSubject("");
      setMessage("");
    } catch {
      toast.error("Unable to send email. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Send email</h1>
        <p className="text-sm text-muted-foreground">
          Compose and send an email using the connected Gmail account.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>New message</CardTitle>
          <CardDescription>
            Enter the recipient and the contents of your email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email-to">To</Label>
              <Input
                id="email-to"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
                disabled={sending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                placeholder="Email subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
                disabled={sending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-message">Message</Label>
              <Textarea
                id="email-message"
                className="min-h-48 resize-y"
                placeholder="Write your message..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
                disabled={sending}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={sending}>
                <Send aria-hidden="true" />
                {sending ? "Sending..." : "Send email"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}