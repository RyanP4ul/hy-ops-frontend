"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { request } from "@/components/http";
import { QueryFeedback } from "@/components/query-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type DeliveryProof = {
  id: string;
  kind: "photo" | "signature";
  createdAt: string;
};

function ProofImage({ stopId, proof, orderNumber }: { stopId: number; proof: DeliveryProof; orderNumber: string }) {
  const [attempt, setAttempt] = useState(0);
  const [image, setImage] = useState<{ url?: string; error?: string }>({});
  const label = proof.kind === "signature" ? "Recipient signature" : "Delivery photo";

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    async function load() {
      setImage({});
      try {
        const response = await request("GET", `/api/deliveries/stops/${stopId}/proofs/${proof.id}`);
        if (!response.ok) throw new Error("Unable to load this proof image.");
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ url: objectUrl });
      } catch {
        if (active) setImage({ error: "Unable to load this proof image." });
      }
    }
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [stopId, proof.id, attempt]);

  return <figure className="space-y-3 rounded-lg border p-3">
    <figcaption className="space-y-1">
      <p className="font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">Uploaded {new Date(proof.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })} (Manila)</p>
    </figcaption>
    {image.error ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
      <span>{image.error}</span>
      <Button type="button" variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>Retry</Button>
    </div> : image.url ? <>
      {/* Authenticated proof bytes use a temporary local URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={`${label} for order ${orderNumber}`} className="max-h-96 w-full rounded-md bg-white object-contain" onError={() => setImage({ error: "Unable to display this proof image." })} />
      <a href={image.url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm underline underline-offset-4">Open full-size {proof.kind === "signature" ? "signature" : "photo"}</a>
    </> : <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading image...</p>}
  </figure>;
}

export function ProofOfDeliveryAction({ stopId, orderNumber }: { stopId: number; orderNumber: string }) {
  const [open, setOpen] = useState(false);
  const proofs = useQuery({
    queryKey: ["delivery_proofs", stopId],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const response = await request("GET", `/api/deliveries/stops/${stopId}/proofs`);
      if (!response.ok) throw new Error("Unable to load proof of delivery.");
      const result = await response.json() as DeliveryProof[];
      signal.throwIfAborted();
      return result;
    },
  });

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="outline" size="sm" aria-label={`View proof of delivery for ${orderNumber}`} />}>
      <ImageIcon className="size-4" /> View proof
    </DialogTrigger>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Proof of delivery - {orderNumber}</DialogTitle>
        <DialogDescription>Photos and recipient signature uploaded by the driver for this delivery stop.</DialogDescription>
      </DialogHeader>
      <QueryFeedback query={proofs} label="proof of delivery" />
      {proofs.isPending && !proofs.isError && <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading proof of delivery...</p>}
      {proofs.isSuccess && proofs.data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No proof of delivery has been uploaded for this stop yet.</p>}
      {open && !proofs.isError && <div className="space-y-4">
        {proofs.data?.map(proof => <ProofImage key={proof.id} stopId={stopId} proof={proof} orderNumber={orderNumber} />)}
      </div>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={proofs.isFetching} onClick={() => void proofs.refetch()}>Refresh proofs</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
