"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDialog({ open, onOpenChange }: ProductDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[95vw] max-w-4xl p-0 overflow-hidden
          sm:max-w-4xl
        "
      >
        <div className="grid md:grid-cols-2">
          {/* Left side: Image */}
          <div className="relative hidden min-h-[520px] bg-muted md:block">
            <Image
              src="/images/product.jpg"
              alt="Product preview"
              fill
              priority
              className="object-cover"
              sizes="(min-width: 768px) 50vw, 100vw"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            <div className="absolute bottom-0 p-8 text-white">
              <h2 className="text-2xl font-semibold">Manage your inventory</h2>
              <p className="mt-2 text-sm text-white/80">
                Keep your products and variants organized in one place.
              </p>
            </div>
          </div>

          <div className="flex flex-col p-6 sm:p-8">
            <DialogHeader className="mb-6">
              <DialogTitle>Create Product</DialogTitle>
              <DialogDescription>
                Enter the product information below.
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="name">Product name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Packaging Tape"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" name="sku" placeholder="Enter SKU" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe the product..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>

                <Button type="submit">Create product</Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Page() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create product</Button>

      <ProductDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
