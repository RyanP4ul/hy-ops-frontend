"use client";

import { Input } from "@/components/ui/input";
import React from "react";
import { useSetting } from "@/components/providers/setting-provider";
import { Controller, useForm } from "react-hook-form";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { zodResolver } from "@hookform/resolvers/zod";
import { stockStatusSchema, StockStatusSchema } from "@/schema/setting";
import { ToastSubmit, ToastValidationError } from "@/components/util";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TabInventory() {
  const { settingQuery: query, isModified, setIsModified } = useSetting();

  const form = useForm<StockStatusSchema>({
    resolver: zodResolver(stockStatusSchema),
    defaultValues: {
      low_stock_threshold: 10,
      high_stock_threshold: 100,
    },
  });

  React.useEffect(() => {
    if (!query.data) return;

    form.reset({
      low_stock_threshold: Number(query.data.low_stock_threshold.value),
      high_stock_threshold: Number(query.data.high_stock_threshold.value),
    });
  }, [query.data, form]);

  const onSubmit = (data: StockStatusSchema) => {
    ToastSubmit(data);
    console.log("Form submitted with data:", data);
  };

  return (
    <form
      id="form"
      onSubmit={form.handleSubmit(onSubmit, (error) =>
        ToastValidationError(error),
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>Manage your inventory settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <FieldGroup className="grid grid-cols-1 items-center gap-4">
              <Controller
                name="low_stock_threshold"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Low Stock Threshold</FieldLabel>

                    <Input
                      type="number"
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.valueAsNumber);
                        setIsModified(true);
                      }}
                      aria-invalid={fieldState.invalid}
                    />

                    <FieldDescription>
                      Items at or below this amount are considered low stock.
                    </FieldDescription>
                  </Field>
                )}
              />

              <Controller
                name="high_stock_threshold"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>High Stock Threshold</FieldLabel>

                    <Input
                      type="number"
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.valueAsNumber);
                        setIsModified(true);
                      }}
                      aria-invalid={fieldState.invalid}
                    />

                    <FieldDescription>
                      Items at or above this amount are considered high stock.
                    </FieldDescription>
                  </Field>
                )}
              />
            </FieldGroup>
          </div>
        </CardContent>
        {isModified && (
          <CardFooter className="flex justify-end">
            <Button type="submit" variant="default" disabled={query.isFetching}>
              Save changes
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  );
}
