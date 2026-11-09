import ProductPage from "@/app/(protected)/panel/products/components/product-page";
import { Metadata } from "next";
import DialogPage from "./components/dialog";
import { ProductProvider } from "./provider";
import { ModalProvider } from "@/components/providers/modal-provider";
import VariantDialog from "./components/variant-dialog";
import { MotionPage } from "@/components/page-motion";
import { Package } from "lucide-react";

export const metadata: Metadata = {
  title: "HyOps Products",
  description: "Manage your products with HyOps",
};

export default function Page() {
  return (
    <MotionPage className="space-y-5 py-4 md:py-6 px-4 lg:px-6">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background text-primary"><Package className="size-5" aria-hidden="true" /></div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your catalog, review variants, and keep pricing up to date.</p>
        </div>
      </div>
      <ModalProvider>
        <ProductProvider>
          <DialogPage />
          <ProductPage />
          <VariantDialog />
        </ProductProvider>
      </ModalProvider>
    </MotionPage>
  );
}
