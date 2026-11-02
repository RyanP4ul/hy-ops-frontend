"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { type FormSchema, formSchema } from "@/schema/login";

export default function Page() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });
  const login = useMutation({
    mutationKey: ["authLogin"],
    retry: false,
    mutationFn: async (data: FormSchema) => {
      let response: Response;
      try {
        response = await fetch("/api/auth/login", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, is_mobile: false }),
        });
      } catch {
        throw new Error("Unable to connect. Check your connection and try again.");
      }
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        let focused = false;
        if (result?.errors && typeof result.errors === "object") {
          for (const field of ["email", "password"] as const) {
            if (typeof result.errors[field] === "string") {
              form.setError(field, { type: "server", message: result.errors[field] }, { shouldFocus: !focused });
              focused = true;
            }
          }
        }
        throw new Error(typeof result?.message === "string" ? result.message : response.status >= 500
          ? "Sign-in is temporarily unavailable. Please try again."
          : "We couldn't sign you in. Check your email and password, then try again.");
      }
      return result;
    },
    onSuccess: () => { setRedirecting(true); router.replace("/panel"); },
  });
  const busy = login.isPending || form.formState.isSubmitting || redirecting;
  async function submit(data: FormSchema) {
    if (login.isPending || redirecting) return;
    form.clearErrors("root");
    try { await login.mutateAsync(data); }
    catch (error) { form.setError("root", { message: error instanceof Error ? error.message : "Unable to sign in. Please try again." }); }
  }

  return (
    <main className="grid min-h-svh bg-background text-foreground lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:grid-cols-2">
      <aside className="relative m-4 mr-0 hidden min-h-[640px] overflow-hidden rounded-2xl bg-emerald-950 lg:flex lg:flex-col lg:justify-between">
        <Image src="/login-left-panel.webp" alt="" fill priority sizes="(min-width: 1280px) 50vw, 45vw" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/35 to-black/30" />
        <div className="relative flex items-center gap-3 p-9 xl:p-12">
          <div className="rounded-xl bg-white p-2"><Image src="/logo.png" alt="" width={36} height={36} className="size-9 object-contain" /></div>
          <span className="text-xl font-semibold tracking-tight text-white">HYOps</span>
        </div>
        <div className="relative space-y-6 p-9 xl:p-12">
          <div className="h-1 w-10 bg-emerald-300" />
          <h2 className="max-w-sm text-4xl font-medium leading-[1.15] tracking-tight text-white xl:text-5xl">A clear view of your operation.</h2>
          <p className="max-w-sm text-base leading-relaxed text-emerald-50/85">Keep inventory, deliveries and your team connected in one workspace.</p>
          <p className="border-t border-white/20 pt-6 text-xs tracking-wide text-emerald-50/75">HYOps / Inventory & warehouse management</p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-col px-6 py-8 sm:px-12 lg:px-16 lg:py-10">
        <header className="flex items-center gap-3 lg:invisible" aria-label="HYOps">
          <Image src="/logo.png" alt="HYOps logo" width={40} height={40} priority className="size-10 object-contain" />
          <span className="text-xl font-semibold tracking-tight">HYOps</span>
        </header>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12 sm:py-16 lg:py-10">
          <div className="mb-8">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Your HYOps workspace</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Sign in with your HYOps account to continue.</p>
          </div>
          <form onSubmit={form.handleSubmit(submit)} noValidate aria-busy={busy} className="space-y-5">
            {form.formState.errors.root?.message && <div role="alert" aria-label="Sign-in error" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">{form.formState.errors.root.message}</div>}
            <Controller name="email" control={form.control} render={({ field, fieldState }) => <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <Input {...field} id="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@hyops.com" readOnly={busy} aria-invalid={fieldState.invalid} aria-describedby={fieldState.invalid ? "email-error" : undefined} className="h-12 px-3.5 text-base md:text-base" />
              {fieldState.invalid && <FieldError id="email-error" errors={[fieldState.error]} />}
            </Field>} />
            <Controller name="password" control={form.control} render={({ field, fieldState }) => <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="relative">
                <Input {...field} id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" readOnly={busy} aria-invalid={fieldState.invalid} aria-describedby={[fieldState.invalid ? "password-error" : "", capsLock ? "caps-warning" : ""].filter(Boolean).join(" ") || undefined} onKeyUp={event => setCapsLock(event.getModifierState("CapsLock"))} onKeyDown={event => setCapsLock(event.getModifierState("CapsLock"))} onBlur={() => { field.onBlur(); setCapsLock(false); }} className="h-12 pl-3.5 pr-24 text-base md:text-base" />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="password" disabled={busy} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex min-w-20 items-center justify-center gap-1.5 rounded-r-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}<span>{showPassword ? "Hide" : "Show"}</span>
                </button>
              </div>
              {capsLock && <p id="caps-warning" role="status" className="text-sm text-muted-foreground">Caps Lock is on.</p>}
              {fieldState.invalid && <FieldError id="password-error" errors={[fieldState.error]} />}
            </Field>} />
            <Button type="submit" disabled={busy} className="h-12 w-full gap-2 text-base font-medium">
              {busy ? <><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />{redirecting ? "Opening your workspace..." : "Signing in..."}</> : <>Login<ArrowRight className="size-4" /></>}
            </Button>
          </form>
          <div className="mt-8 border-t pt-5 text-sm leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Need help signing in?</p>
            <p className="mt-1">Contact your HYOps administrator for account access or password assistance.</p>
          </div>
        </div>
        <footer className="text-center text-xs leading-relaxed text-muted-foreground">&copy; {new Date().getFullYear()} HYOps. All rights reserved.</footer>
      </section>
    </main>
  );
}
