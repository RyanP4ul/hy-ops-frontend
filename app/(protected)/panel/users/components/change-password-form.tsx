"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { request, requestWithErrorHandling } from "@/components/http";
import { ToastValidationError } from "@/components/util";
import { DialogMode } from "@/types/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useModal } from "@/components/providers/modal-provider";
import { useUser } from "../provider";

const changePasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordForm() {
  const { state, dispatch } = useModal();
  const { selected, userQuery } = useUser();
  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: ChangePasswordForm) {
    const response = await request(
      "PATCH",
      `/api/users/${selected.id}/password`,
      { password: data.password },
    );

    await requestWithErrorHandling(response, form, () => {
      userQuery.refetch();
      dispatch({ type: "CLOSE" });
    });
  }

  if (state.mode !== DialogMode.CHANGE_PASSWORD) return null;

  return (
    <form
      id="form"
      onSubmit={form.handleSubmit(onSubmit, (errors) =>
        ToastValidationError(errors),
      )}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">
        Set a new password for this user. Existing sessions will be signed out.
      </p>
      <div className="space-y-4">
        {form.formState.errors.root?.message && <p role="alert">{form.formState.errors.root.message}</p>}
      <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="new-password">
                New password<span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="confirm-password">
                Confirm password<span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>
      <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Change password"}</Button>
    </form>
  );
}
