"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { request } from "@/components/http";

type ProofMeta = {
  id: string;
  kind: "photo" | "signature";
  contentType: string;
  byteSize: number;
  createdAt: string;
};

function ProofThumbnail({
  returnId,
  proof,
}: {
  returnId: number;
  proof: ProofMeta;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const res = await request(
          "GET",
          `/api/deliveries/returns/${returnId}/proofs/${proof.id}`,
        );
        if (!res.ok) return;
        const blob = await res.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        // Ignore preview load error
      }
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [returnId, proof.id]);

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="group relative block overflow-hidden rounded-md border bg-muted/30"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={proof.kind === "signature" ? "Customer handover signature" : "Return pickup photo"}
          className="h-20 w-24 object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="flex h-20 w-24 items-center justify-center text-[10px] text-muted-foreground">
          Loading…
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[10px] capitalize text-white">
        {proof.kind}
      </span>
    </a>
  );
}

export function ReturnProofsGallery({ returnId }: { returnId: number }) {
  const proofsQuery = useQuery<ProofMeta[]>({
    queryKey: ["return-pickup-proofs", returnId],
    queryFn: async () => {
      const response = await request(
        "GET",
        `/api/deliveries/returns/${returnId}/proofs`,
      );
      if (!response.ok) return [];
      return response.json();
    },
  });

  const proofs = proofsQuery.data ?? [];
  if (proofsQuery.isPending) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Loading driver collection proofs…
      </p>
    );
  }
  if (!proofs.length) return null;

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/20 p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Camera className="size-3.5" aria-hidden="true" />
        Driver Proof of Collection ({proofs.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {proofs.map((proof) => (
          <ProofThumbnail key={proof.id} returnId={returnId} proof={proof} />
        ))}
      </div>
    </div>
  );
}
