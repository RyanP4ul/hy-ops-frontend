"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Package,
  Truck,
  CreditCard,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { orderSchema, type OrderWizardData } from "./order-schema";

type CreateOrderWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitOrder?: (data: OrderWizardData) => void | Promise<void>;
};

const steps = [
  { title: "Order", description: "Order details", icon: Package },
  { title: "Delivery", description: "Delivery schedule", icon: Truck },
  { title: "Payment", description: "Payment method", icon: CreditCard },
  { title: "Review", description: "Review order", icon: ClipboardCheck },
];

const initialData: OrderWizardData = {
  customer: "",
  product: "",
  quantity: 1,
  deliveryMethod: "truck",
  driver: "",
  vehicle: "",
  scheduledDate: "",
  paymentMethod: "cash",
};

export function CreateOrderWizard({
  open,
  onOpenChange,
  onSubmitOrder,
}: CreateOrderWizardProps) {
  const [step, setStep] = useState(0);

  const form = useForm<OrderWizardData>({
    resolver: zodResolver(orderSchema),
    defaultValues: initialData,
    mode: "onTouched",
  });

  const {
    control,
    register,
    watch,
    trigger,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const data = watch();

  const fieldsByStep: (keyof OrderWizardData)[][] = [
    ["customer", "product", "quantity"],
    ["deliveryMethod", "driver", "vehicle", "scheduledDate"],
    ["paymentMethod"],
    [],
  ];

  async function handleNext() {
    const fields = fieldsByStep[step] ?? [];

    // Driver and vehicle are not required for Lalamove.
    const fieldsToValidate =
      step === 1 && data.deliveryMethod === "lalamove"
        ? (["deliveryMethod", "scheduledDate"] as const)
        : fields;

    const isValid = await trigger([...fieldsToValidate]);

    if (!isValid) return;

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function handleBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleCreateOrder(values: OrderWizardData) {
    if (!onSubmitOrder) {
      form.setError("root", {
        message: "Order submission has not been configured.",
      });
      return;
    }

    try {
      await onSubmitOrder(values);

      reset(initialData);
      setStep(0);
      onOpenChange(false);
    } catch {
      form.setError("root", {
        message: "Failed to create the order. Please try again.",
      });
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return;

    onOpenChange(nextOpen);

    if (!nextOpen) {
      reset(initialData);
      setStep(0);
    }
  }

  const paymentLabels: Record<OrderWizardData["paymentMethod"], string> = {
    cash: "Cash",
    bank_transfer: "Bank Transfer",
    card: "Card",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl">Create Order</DialogTitle>
          <DialogDescription>
            Complete each step to create a new order.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="border-y px-6 py-4">
          <div className="grid grid-cols-4 gap-2">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const completed = index < step;
              const active = index === step;

              return (
                <div key={item.title} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${
                        completed
                          ? "border-primary bg-primary text-primary-foreground"
                          : active
                            ? "border-primary text-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      {completed ? (
                        <Check className="size-4" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </div>

                    <span
                      className={`hidden truncate text-sm font-medium sm:block ${
                        active ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>

                  <div
                    className={`mt-3 h-1 rounded-full ${
                      index <= step ? "bg-primary" : "bg-muted"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Step {step + 1} of {steps.length} · {steps[step].description}
          </p>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold">Order Details</h3>
                <p className="text-sm text-muted-foreground">
                  Specify the customer and items being ordered.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <Input
                  id="customer"
                  placeholder="Enter customer or company name"
                  {...register("customer")}
                  aria-invalid={!!errors.customer}
                />
                {errors.customer && (
                  <p className="text-sm text-destructive">
                    {errors.customer.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="product">Product</Label>
                <Input
                  id="product"
                  placeholder="Enter product name or SKU"
                  {...register("product")}
                  aria-invalid={!!errors.product}
                />
                {errors.product && (
                  <p className="text-sm text-destructive">
                    {errors.product.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Replace this input with your product/variant combobox.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  step={1}
                  {...register("quantity", { valueAsNumber: true })}
                  aria-invalid={!!errors.quantity}
                />
                {errors.quantity && (
                  <p className="text-sm text-destructive">
                    {errors.quantity.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold">Delivery Details</h3>
                <p className="text-sm text-muted-foreground">
                  Choose how and when the order will be delivered.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Delivery Method</Label>
                <Controller
                  control={control}
                  name="deliveryMethod"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={!!errors.deliveryMethod}>
                        <SelectValue placeholder="Select delivery method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="truck">Company Truck</SelectItem>
                        <SelectItem value="lalamove">Lalamove</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.deliveryMethod && (
                  <p className="text-sm text-destructive">
                    {errors.deliveryMethod.message}
                  </p>
                )}
              </div>

              {data.deliveryMethod === "truck" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Driver</Label>
                    <Controller
                      control={control}
                      name="driver"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger aria-invalid={!!errors.driver}>
                            <SelectValue placeholder="Select driver" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="driver-1">Driver 1</SelectItem>
                            <SelectItem value="driver-2">Driver 2</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.driver && (
                      <p className="text-sm text-destructive">
                        {errors.driver.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Vehicle</Label>
                    <Controller
                      control={control}
                      name="vehicle"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger aria-invalid={!!errors.vehicle}>
                            <SelectValue placeholder="Select vehicle" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="truck-1">Truck 1</SelectItem>
                            <SelectItem value="truck-2">Truck 2</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.vehicle && (
                      <p className="text-sm text-destructive">
                        {errors.vehicle.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {data.deliveryMethod === "lalamove" && (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  Lalamove delivery details and quotation can be handled through
                  your Lalamove integration.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="scheduledDate">Scheduled Delivery Date</Label>
                <Input
                  id="scheduledDate"
                  type="date"
                  {...register("scheduledDate")}
                  aria-invalid={!!errors.scheduledDate}
                />
                {errors.scheduledDate && (
                  <p className="text-sm text-destructive">
                    {errors.scheduledDate.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold">Payment Details</h3>
                <p className="text-sm text-muted-foreground">
                  Select the customer's payment method.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Controller
                  control={control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={!!errors.paymentMethod}>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">
                          Bank Transfer
                        </SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.paymentMethod && (
                  <p className="text-sm text-destructive">
                    {errors.paymentMethod.message}
                  </p>
                )}
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Payment status should be recorded separately from the payment
                method. Selecting a method does not mean the customer has
                already paid.
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold">Review Order</h3>
                <p className="text-sm text-muted-foreground">
                  Check the information before submitting.
                </p>
              </div>

              <section className="space-y-3">
                <h4 className="text-sm font-medium">Order Information</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReviewItem label="Customer" value={data.customer} />
                  <ReviewItem label="Product" value={data.product} />
                  <ReviewItem label="Quantity" value={String(data.quantity)} />
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <h4 className="text-sm font-medium">Delivery Information</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReviewItem
                    label="Delivery Method"
                    value={
                      data.deliveryMethod === "truck"
                        ? "Company Truck"
                        : "Lalamove"
                    }
                  />

                  {data.deliveryMethod === "truck" && (
                    <>
                      <ReviewItem label="Driver" value={data.driver} />
                      <ReviewItem label="Vehicle" value={data.vehicle} />
                    </>
                  )}

                  <ReviewItem
                    label="Scheduled Date"
                    value={data.scheduledDate}
                  />
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <h4 className="text-sm font-medium">Payment Information</h4>
                <ReviewItem
                  label="Payment Method"
                  value={paymentLabels[data.paymentMethod]}
                />
              </section>

              <p className="text-xs text-muted-foreground">
                Final pricing, stock availability, and delivery scheduling must
                be validated by the backend.
              </p>
            </div>
          )}

          {errors.root && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex-row items-center justify-between border-t p-6 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={step === 0 || isSubmitting}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>

          {step < steps.length - 1 ? (
            <Button type="button" onClick={handleNext} disabled={isSubmitting}>
              Next
              <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit(handleCreateOrder)}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isSubmitting ? "Creating..." : "Create Order"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">
        {value || "Not specified"}
      </p>
    </div>
  );
}
