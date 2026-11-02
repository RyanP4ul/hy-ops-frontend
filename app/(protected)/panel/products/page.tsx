import ProductPage from "@/app/(protected)/panel/products/components/product-page";
import { Metadata } from "next";
import DialogPage from "./components/dialog";
import { ProductProvider } from "./provider";
import { ModalProvider } from "@/components/providers/modal-provider";
import VariantDialog from "./components/variant-dialog";
import { MotionPage } from "@/components/page-motion";

export const metadata: Metadata = {
  title: "HyOps Products",
  description: "Manage your products with HyOps",
};

export default function Page() {
  return (
    <MotionPage className="py-4 md:py-6 px-4 lg:px-6">
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
