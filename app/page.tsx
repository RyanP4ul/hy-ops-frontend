"use client";

import { LoginForm } from "@/components/features/login/login-form";
import Image from "next/image";
import { motion } from "motion/react";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Phone, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { FormSchema, formSchema } from "@/schema/login";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useRouter } from "next/navigation";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export default function Page() {
  const router = useRouter();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const authLoginMutation = useMutation({
    mutationKey: ["authLogin"],

    mutationFn: async (data: FormSchema) => {
      console.log("Submitting login data:", data);

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result?.errors && typeof result.errors === "object") {
          Object.entries(result.errors).forEach(([field, message]) => {
            if (field === "email" || field === "password") {
              form.setError(field, {
                type: "server",
                message: String(message),
              });
            }
          });
        }

        throw new Error(
          result?.message ?? "Login failed. Please check your credentials.",
        );
      }

      return result;
    },

    onSuccess: () => {
      router.replace("/panel");
    },
  });

  async function handleSubmit(data: FormSchema) {
    await authLoginMutation.mutateAsync(data);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex min-h-0 flex-1">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative hidden lg:flex lg:w-1/2 xl:w-[55%]"
        >
          <Image
            src="/login-left-panel.webp"
            alt="HyOps warehouse"
            fill
            className="object-cover"
            priority
            sizes="(min-width: 1024px) 55vw, 50vw"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          {/* Bottom-left tagline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.6,
              duration: 0.6,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="absolute inset-x-0 bottom-0 px-10 pb-12 xl:px-16 xl:pb-16"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
              HyOps
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-white xl:text-4xl">
              Smart Inventory
              <br />
              Management
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
              Streamline your warehouse operations with real-time tracking,
              intelligent analytics, and seamless team collaboration.
            </p>
          </motion.div>
        </motion.div>

        {/* ─── RIGHT PANEL: Login Form ─── */}
        <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-12 lg:w-1/2 xl:w-[45%]">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="flex w-full max-w-sm flex-col items-center"
          >
            {/* Logo */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.5 }}
              className="mb-8 flex items-center gap-3 self-start"
            >
              <img
                src="/hy-ops-logo.png"
                alt="HyOps"
                className="h-11 w-11 shrink-0 rounded-xl object-contain shadow-lg shadow-primary/25"
              />
              <div>
                <h1 className="text-xl font-bold tracking-tight">HyOps</h1>
                <p className="text-xs text-muted-foreground">
                  Inventory & Warehouse Platform
                </p>
              </div>
            </motion.div>

            {/* Welcome text */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <h2 className="text-2xl font-bold tracking-tight">
                Welcome back
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your credentials to access your account
              </p>
            </motion.div>

            {/* Form */}
            <form
              id="form"
              // variants={staggerContainer}
              // initial="initial"
              // animate="animate"
              onSubmit={form.handleSubmit(handleSubmit, (errors) => {
                console.log("❌ Form validation failed:", errors);
                console.log("Current form values:", form.getValues());
              })}
              className="mt-8 w-full space-y-5"
            >
              <FieldGroup className="grid grid-cols-1 items-center gap-4">
                <motion.div
                  variants={fadeInUp}
                  transition={{ duration: 0.35 }}
                  className="space-y-2"
                >
                  <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="email">
                          Email Address
                          <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          type="email"
                          aria-invalid={fieldState.invalid}
                          placeholder="Enter email"
                          autoComplete="off"
                          disabled={
                            authLoginMutation.isPending ||
                            form.formState.isSubmitting
                          }
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </motion.div>
                <motion.div
                  variants={fadeInUp}
                  transition={{ duration: 0.35 }}
                  className="space-y-2"
                >
                  <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="password">
                          Password
                          <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          type="password"
                          aria-invalid={fieldState.invalid}
                          placeholder="Enter password"
                          autoComplete="off"
                          disabled={
                            authLoginMutation.isPending ||
                            form.formState.isSubmitting
                          }
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </motion.div>
              </FieldGroup>

              {/* Login button */}
              <motion.div variants={fadeInUp} transition={{ duration: 0.35 }}>
                <Button
                  form="form"
                  type="submit"
                  className="relative h-11 w-full text-sm font-semibold shadow-lg shadow-primary/20"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2"
                    >
                      <Loader2 className="size-4 animate-spin" />
                      Logging in...
                    </motion.span>
                  ) : (
                    "Login"
                  )}
                </Button>
              </motion.div>
            </form>

            {/* Contact & Copyright */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.4 }}
              className="mt-10 space-y-3 text-center"
            >
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Mail className="size-3" />
                  <span>support@hyops.com</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="size-3" />
                  <span>+1 (555) 123-4567</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/70">
                &copy; {new Date().getFullYear()} HyOps. All rights reserved.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
