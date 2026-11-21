"use client";

import type { ReactNode } from "react";
import { AlertCircle, Loader2, Mail, MessageSquare, Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SendReview({
  channel,
  recipient,
  description,
  children,
  busy,
  error,
  onClose,
  onSend,
}: {
  channel: "SMS" | "email";
  recipient: string;
  description?: string;
  children: ReactNode;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSend: () => void;
}) {
  const Icon = channel === "SMS" ? MessageSquare : Mail;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[90svh] overflow-y-auto p-5 sm:max-w-xl sm:p-6"
      >
        <DialogHeader className="gap-1.5 pr-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight">
                Review {channel}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Confirm the recipient and message content before dispatching.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="min-w-0 divide-y rounded-xl border bg-muted/25 text-sm">
            <div className="flex items-start gap-2.5 px-3.5 py-2.5">
              <UserRound
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  To
                </p>
                <p className="mt-0.5 break-all font-medium text-foreground">
                  {recipient}
                </p>
              </div>
            </div>
            {description && (
              <div className="px-3.5 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {channel === "SMS" ? "Gateway & template" : "Subject"}
                </p>
                <p className="mt-0.5 break-words text-sm text-foreground/90">
                  {description}
                </p>
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Message content
            </p>
            {children}
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/5 p-3.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="min-w-0 break-words">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={busy}
            onClick={onClose}
          >
            Back to message
          </Button>
          <Button
            type="button"
            className="cursor-pointer gap-2"
            disabled={busy}
            onClick={onSend}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Sending...
              </>
            ) : (
              <>
                <Send className="size-4" aria-hidden="true" />
                {`Send ${channel}`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
