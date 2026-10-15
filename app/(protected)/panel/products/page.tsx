import ProductPage from "@/app/(protected)/panel/products/components/product-page";
import { Metadata } from "next";
import DialogPage from "./components/dialog";
import { ProductProvider } from "./provider";
import { ModalProvider } from "@/components/providers/modal-provider";
import VariantDialog from "./components/variant-dialog";

export const metadata: Metadata = {
  title: "HyOps Products",
  description: "Manage your products with HyOps",
};

export default function Page() {
  return (
    <div className="py-4 md:py-6 px-4 lg:px-6">
      <ProductProvider>
        <ModalProvider>
          <DialogPage />
          <ProductPage />
        </ModalProvider>
        <VariantDialog />
      </ProductProvider>
    </div>
  );
}
