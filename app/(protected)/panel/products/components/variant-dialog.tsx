"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProducts } from "../provider";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { ProductVariantType, productVariantSchema } from "@/schema/product";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToastValidationError } from "@/components/util";
import { useModal } from "@/components/providers/modal-provider";
import { DialogMode } from "@/types/dialog";
import { useEffect, useState } from "react";

export default function VariantDialog() {
  const { form, variant, setVariant, variantDetailQuery } = useProducts();

  const variant_form = useForm<ProductVariantType>({
    resolver: zodResolver(productVariantSchema),
    defaultValues: {
      name: "",
      sku: "HY-",
      description: "",
      price: "0.00",
      unit: "box",
      weight_kg: "0.00",
      width_value: "0",
      width_unit: "m",
      length_value: "0.00",
      length_unit: "m",
    },
  });

  const product_units = [
    { value: "pcs", label: "Pieces" },
    { value: "roll", label: "Roll" },
    { value: "sheet", label: "Sheet" },
    { value: "box", label: "Box" },
    { value: "pack", label: "Pack" },
    { value: "set", label: "Set" },
    { value: "meter", label: "Meter" },
    { value: "kg", label: "Kilogram" },
  ];

  const dimension_units = [
    { value: "mm", label: "Millimeter" },
    { value: "cm", label: "Centimeter" },
    { value: "m", label: "Meter" },
    { value: "in", label: "Inch" },
    { value: "ft", label: "Feet" },
  ];

  const fieldArray = useFieldArray({
    control: form.control,
    name: "variants",
  });

  async function onSubmit(data: ProductVariantType) {
    const existingVariant = form
      .getValues("variants")
      .find((variant) => variant.sku === data.sku);

    if (existingVariant) {
      variant_form.setError("sku", {
        type: "manual",
        message: "Duplicate SKU found. Please use a unique SKU.",
      });
      return;
    }

    fieldArray.append(data);
    variant_form.reset();
    setVariant({ is_open: false, mode: DialogMode.DEFAULT });
  }

  const getModalSize = () => {
    switch (variant.mode) {
      case DialogMode.ARCHIVE:
      case DialogMode.DELETE:
        return "sm:max-w-md";
      case DialogMode.CUSTOM:
        return "sm:max-w-3xl";
      default:
        return "sm:max-w-5xl";
    }
  };

  function Form() {
    return (
      <form
        id="variant-form"
        onSubmit={variant_form.handleSubmit(onSubmit, (error) =>
          ToastValidationError(error),
        )}
      >
        <FieldGroup className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-1">
            <div className="grid grid-cols-2 gap-2">
              <Controller
                name="name"
                control={variant_form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="name">
                      Name<span className="text-destructive">*</span>
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
              <Controller
                name="sku"
                control={variant_form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="name">
                      SKU<span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      {...field}
                      id="sku"
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter sku"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                    <FieldDescription>
                      Must be unique across variants.
                    </FieldDescription>
                  </Field>
                )}
              />
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Controller
              name="price"
              control={variant_form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="price">
                    Price<span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id="price"
                    aria-invalid={fieldState.invalid}
                    type="number"
                    placeholder="Enter price"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="unit"
              control={variant_form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="unit">
                    Unit<span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select
                    name={field.name}
                    items={product_units}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      aria-invalid={fieldState.invalid}
                      className="w-full max-w-48"
                      onBlur={field.onBlur}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Product Units</SelectLabel>
                        {product_units.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
          <Controller
            name="description"
            control={variant_form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="name">
                  Description<span className="text-destructive">*</span>
                </FieldLabel>
                <Textarea
                  {...field}
                  id="description"
                  aria-invalid={fieldState.invalid}
                  placeholder="Product Variant Description"
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid grid-cols-[minmax(0,1fr)_82px] gap-2">
                <Controller
                  name="width_value"
                  control={variant_form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="name">
                        Width<span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        {...field}
                        id="width_value"
                        aria-invalid={fieldState.invalid}
                        type="number"
                        placeholder="Enter width value"
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="width_unit"
                  control={variant_form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="width_unit">
                        Unit<span className="text-destructive">*</span>
                      </FieldLabel>
                      <Select
                        name={field.name}
                        items={dimension_units}
                        defaultValue={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full max-w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Width Unit</SelectLabel>
                            {product_units.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_82px] gap-2">
                <Controller
                  name="length_value"
                  control={variant_form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="name">
                        Length<span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        {...field}
                        id="length_value"
                        aria-invalid={fieldState.invalid}
                        type="number"
                        placeholder="Enter length value"
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="length_unit"
                  control={variant_form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="name">
                        Unit<span className="text-destructive">*</span>
                      </FieldLabel>
                      <Select
                        items={dimension_units}
                        defaultValue={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full max-w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Length Unit</SelectLabel>
                            {product_units.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_82px] gap-2">
                <Field>
                  <FieldLabel htmlFor="name">
                    Length<span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="length_value"
                    type="number"
                    placeholder="Enter length value"
                    autoComplete="off"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="name">
                    Thickness<span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select items={dimension_units} defaultValue="cm">
                    <SelectTrigger className="w-full max-w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Thickness Unit</SelectLabel>
                        {product_units.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </div>
        </FieldGroup>
      </form>
    );
  }

  async function onDelete() {
    if (variant.id === undefined) {
      console.error("Variant ID is undefined. Cannot delete variant.");
      return;
    }

    fieldArray.remove(variant.id);
    setVariant({ is_open: false, mode: DialogMode.DEFAULT });
  }

  function DeleteConfirmation() {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete this variant? This action cannot be
          undone.
        </p>
      </div>
    );
  }

  useEffect(() => {
    if (variant.mode === DialogMode.EDIT && variantDetailQuery.data) {
      variant_form.reset(variantDetailQuery.data);
    } else {
      variant_form.reset({
        name: "",
        sku: "HY-",
        description: "",
        price: "0.00",
        unit: "box",
        weight_kg: "0.00",
        width_value: "0",
        width_unit: "m",
        length_value: "0.00",
        length_unit: "m",
      });
    }
  }, [variant.mode, variantDetailQuery.isFetched]);

  return (
    <>
      <Dialog
        open={variant.is_open}
        onOpenChange={(open) => setVariant({ ...variant, is_open: open })}
      >
        <DialogContent className={getModalSize()}>
          <DialogHeader>
            <DialogTitle>
              {variant.mode === DialogMode.INSERT
                ? "Add Variant"
                : variant.mode === DialogMode.EDIT
                  ? "Edit Variant"
                  : "Delete Variant"}
            </DialogTitle>
            <DialogDescription>
              {variant.mode === DialogMode.INSERT
                ? "Add a new variant"
                : variant.mode === DialogMode.EDIT
                  ? "Edit this variant"
                  : "Are you sure you want to delete this variant?"}
            </DialogDescription>
          </DialogHeader>

          {variant.mode === DialogMode.INSERT ||
          variant.mode === DialogMode.EDIT ? (
            <Form />
          ) : (
            <DeleteConfirmation />
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setVariant({ is_open: false, mode: DialogMode.DEFAULT })
              }
            >
              Cancel
            </Button>

            <Button
              variant={
                variant.mode === DialogMode.DELETE ? "destructive" : "default"
              }
              onClick={() => variant.mode === DialogMode.DELETE && onDelete()}
              type="submit"
              form="variant-form"
            >
              {variant.mode === DialogMode.INSERT
                ? "Add Variant"
                : variant.mode === DialogMode.EDIT
                  ? "Save Changes"
                  : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
