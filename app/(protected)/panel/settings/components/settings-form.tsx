"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Check, Loader2, Save, type LucideIcon } from "lucide-react";
import { Controller, type Control, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { useSetting } from "@/components/providers/setting-provider";
import { request, requestWithErrorHandling } from "@/components/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

type Settings = NonNullable<ReturnType<typeof useSetting>["settingQuery"]["data"]>;

export function useSettingsForm<T extends FieldValues>(form: UseFormReturn<T>, read: (settings: Settings) => T) {
  const { settingQuery: query } = useSetting();
  const baseline = useRef(query.data);

  useEffect(() => {
    // Background refreshes must not overwrite an unsaved draft in either tab.
    if (query.data && !form.formState.isDirty) {
      baseline.current = query.data;
      form.reset(read(query.data));
    }
  }, [query.data, form, read]);

  async function save(data: T) {
    form.clearErrors("root");
    const changes = Object.entries(data).map(([name, value]) => ({
      name,
      value: String(value),
      version: baseline.current?.[name as keyof Settings]?.version ?? 1,
    }));
    const response = await request("POST", "/api/settings", changes);
    let saved = false;
    await requestWithErrorHandling(response, form, () => { saved = true; });
    if (saved) {
      const refreshed = await query.refetch();
      if (refreshed.data && !refreshed.isError) {
        baseline.current = refreshed.data;
        form.reset(read(refreshed.data));
      } else {
        // The save succeeded even if reloading failed; advance local versions.
        const updated = { ...baseline.current } as Settings;
        for (const change of changes) {
          const key = change.name as keyof Settings;
          updated[key] = { ...updated[key], value: change.value, version: change.version + 1 };
        }
        baseline.current = updated;
        form.reset(data);
      }
    }
  }

  function discard() {
    const latest = query.isError ? baseline.current : query.data;
    if (latest) {
      baseline.current = latest;
      form.reset(read(latest));
    }
  }

  return { save, discard };
}

export function SettingsSection({ title, description, icon: Icon, children }: {
  title: string; description: string; icon: LucideIcon; children: ReactNode;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <div>
        <div className="mb-2 flex items-center gap-2"><Icon className="size-4 text-muted-foreground" aria-hidden="true" /><h3 className="font-semibold">{title}</h3></div>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0 rounded-xl border bg-card p-5 shadow-xs sm:p-6">{children}</div>
    </section>
  );
}

export function NumberSetting<T extends FieldValues>({ control, name, label, description, unit, min = 0, max, step = "any", hint }: {
  control: Control<T>; name: Path<T>; label: string; description: string;
  unit: string; min?: number; max?: number; step?: number | "any"; hint?: string;
}) {
  return (
    <Controller name={name} control={control} render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid} className="gap-2">
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        <FieldDescription id={`${name}-description`} className="leading-relaxed">{description}</FieldDescription>
        <div className="relative mt-1 w-full sm:max-w-64">
          <Input {...field} id={name} type="number" min={min} max={max} step={step}
            value={Number.isFinite(field.value) ? field.value : ""}
            onChange={(event) => field.onChange(event.target.valueAsNumber)}
            aria-invalid={fieldState.invalid}
            aria-describedby={`${name}-description${fieldState.error ? ` ${name}-error` : hint ? ` ${name}-hint` : ""}`}
            className="h-11 bg-background pr-20 tabular-nums" />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground" aria-hidden="true">{unit}</span>
        </div>
        {fieldState.error ? <p id={`${name}-error`} role="alert" className="text-xs text-destructive">{fieldState.error.message}</p>
          : hint && <p id={`${name}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      </Field>
    )} />
  );
}

export function SettingsActions({ dirty, saving, error, onDiscard }: {
  dirty: boolean; saving: boolean; error?: string; onDiscard: () => void;
}) {
  return (
    <div className="sticky bottom-4 z-10 rounded-xl border bg-background/95 p-4 shadow-sm backdrop-blur-sm">
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : dirty ? <span className="size-2 rounded-full bg-amber-500" /> : <Check className="size-4" aria-hidden="true" />}
          {saving ? "Saving changes…" : dirty ? "You have unsaved changes" : "No unsaved changes"}
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button type="button" variant="ghost" className="h-10 flex-1 sm:flex-none" disabled={!dirty || saving} onClick={onDiscard}>Discard</Button>
          <Button type="submit" className="h-10 flex-1 gap-2 px-4 sm:flex-none" disabled={!dirty || saving}><Save aria-hidden="true" /> Save changes</Button>
        </div>
      </div>
    </div>
  );
}
