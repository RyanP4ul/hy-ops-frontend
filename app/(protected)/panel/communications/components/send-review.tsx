"use client";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function SendReview({ channel, recipient, description, children, busy, error, onClose, onSend }: { channel: "SMS" | "email"; recipient: string; description?: string; children: ReactNode; busy: boolean; error: string; onClose: () => void; onSend: () => void }) {
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent showCloseButton={!busy} className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>Review {channel}</DialogTitle><DialogDescription>Check the recipient and message before sending.</DialogDescription></DialogHeader>
    <div className="min-w-0 text-sm"><p className="text-muted-foreground">To</p><p className="break-all font-medium">{recipient}</p>{description && <p className="mt-2 break-words text-muted-foreground">{description}</p>}</div>
    {children}
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p>}
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Back to message</Button><Button disabled={busy} onClick={onSend}>{busy ? <><Loader2 className="size-4 animate-spin" />Sending...</> : `Send ${channel}`}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
