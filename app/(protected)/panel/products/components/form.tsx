import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { ToastSubmit, ToastValidationError } from "@/components/util";
import { Controller, useFieldArray } from "react-hook-form";
import { useProducts } from "../provider";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group";
import { Edit, Layers, Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";
import { ProductType } from "@/schema/product";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Form() {
  // const { send } = useWebSocket();
  const { state, dispatch } = useModal();
  const {
    productDetailQuery,
    form,
    createProduct,
    updateProduct,
    deleteProduct,
    selected,
    setVariant,
  } = useProducts();

  const fieldArray = useFieldArray({
    control: form.control,
    name: "variants",
  });

  // function addProductVariant() {
  //   const newVariant = {
  //     id: -1,
  //     name: "",
  //     sku: "",
  //     price: "0.00",
  //   };

  //   append(newVariant);
  // }

  async function onSubmit(data: ProductType) {
    ToastSubmit(data);

    try {
      if (state.mode === DialogMode.EDIT && selected.id > 0) {
        await updateProduct.mutateAsync({
          ...data,
          id: selected.id,
          version: productDetailQuery?.data?.version ?? 0,
        });
      } else {
        await createProduct.mutateAsync(data);
      }

      dispatch({
        type: "CLOSE",
      });
    } catch (error) {
      const errorData =
        error instanceof Error ? JSON.parse(error.message) : null;

      if (errorData?.errors) {
        Object.entries(errorData.errors).forEach(([field, message]) => {
          form.setError(field as keyof ProductType, {
            type: "manual",
            message: message as string,
          });
        });
      } else {
        toast.error("An error occurred while creating the product.");
      }
    }
  }

  useEffect(() => {
    // if (state.mode === DialogMode.EDIT && productDetailQuery.data) {
    console.log(
      `state: ${state.mode}, selected.id: ${selected.id}, productDetailQuery.data: ${JSON.stringify(productDetailQuery?.data, null, 2)}`,
    );
    if (state.mode === DialogMode.EDIT && productDetailQuery.data) {
      console.log(
        "Resetting form with product details:",
        JSON.stringify(productDetailQuery?.data, null, 2),
      );
      form.reset(productDetailQuery?.data ?? {});
    } else {
      console.log("Resetting form to default values");
      form.reset({
        name: "",
        variants: [],
        version: 0,
      });
    }
  }, [state, productDetailQuery.isFetched]);

  return (
    <>
      <form
        id="form"
        onSubmit={form.handleSubmit(onSubmit, (error) =>
          ToastValidationError(error),
        )}
      >
        <FieldGroup className="grid grid-cols-1 items-center gap-4">
          <Controller
            name="name"
            control={form.control}
            disabled={
              (state.mode === DialogMode.EDIT &&
                productDetailQuery?.isFetching) ||
              productDetailQuery?.isFetching
            }
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="name">
                  Product Name<span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  {...field}
                  id="name"
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter name"
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </form>
      <section className="space-y-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-sm font-semibold">Product variants</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              SKU, price, and measurement details for each option.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setVariant({
                is_open: true,
                mode: DialogMode.INSERT,
              });
            }}
          >
            <Plus className="mr-1.5 size-3.5" />
            Add variant
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="min-w-32.5">SKU</TableHead>
                  <TableHead className="min-w-45">Description</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="min-w-40">Dimensions</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {form.getValues("variants").map((variant, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{variant.sku}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {variant.name || "—"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {variant.description || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {variant.price !== "" &&
                      Number.isFinite(Number(variant.price))
                        ? `₱${Number(variant.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "—"}
                    </TableCell>
                    <TableCell>{variant.unit || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[
                        variant.width_value
                          ? `W ${variant.width_value} ${variant.width_unit}`
                          : "",
                        variant.length_value
                          ? `L ${variant.length_value} ${variant.length_unit}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Not specified"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {variant.weight_kg ? `${variant.weight_kg} kg` : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          form.setValue("variants", [
                            ...form.getValues("variants"),
                          ]);

                          setVariant({
                            id: variant.id,
                            is_open: true,
                            mode: DialogMode.EDIT,
                          });
                        }}
                      >
                        <Edit className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setVariant({
                            id: index,
                            is_open: true,
                            mode: DialogMode.DELETE,
                          });
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {form.getValues("variants").length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      No variants have been added yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </>
  );
}
