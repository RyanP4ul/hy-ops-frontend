"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";

export type WorkflowStep = {
  title: string;
  description: string;
  icon: LucideIcon;
  details: string[];
};

export function WorkflowStepper({ label, steps, current, onBackToStep, disabled = false, summary }: {
  label: string;
  steps: WorkflowStep[];
  current: number;
  onBackToStep: (step: number) => void;
  disabled?: boolean;
  summary?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(current);
  useEffect(() => {
    if (previous.current !== current) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "nearest" });
      previous.current = current;
    }
  }, [current]);
  const active = steps[current];
  return <section className="min-w-0 space-y-4 border-y py-4">
    <nav aria-label={label}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Step {current + 1} of {steps.length}</p>
        <p>Return to an earlier step to make changes.</p>
      </div>
      <ol className={`grid gap-2 ${steps.length > 4 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-4"}`}>
        {steps.map((step, index) => {
          const completed = index < current, selected = index === current;
          const Icon = step.icon;
          return <li key={step.title} className="min-w-0">
            <button type="button" aria-current={selected ? "step" : undefined}
              aria-label={`${index + 1}. ${step.title}${completed ? ", return to this step" : selected ? ", current step" : ", upcoming step"}`}
              disabled={disabled || !completed} onClick={() => onBackToStep(index)}
              className={`flex h-full min-h-16 w-full items-center gap-2 rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected ? "border-primary/50 bg-primary/5" : completed ? "border-border bg-background hover:bg-muted" : "border-transparent bg-muted/30 text-muted-foreground"} disabled:cursor-default`}>
              <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${selected ? "bg-primary text-primary-foreground" : completed ? "bg-primary/10 text-primary" : "border bg-background"}`}>{completed ? <Check className="size-4" /> : index + 1}</span>
              <span className="min-w-0"><span className="block break-words text-xs font-semibold leading-relaxed">{step.title}</span><span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Icon aria-hidden="true" className="size-3 shrink-0" />{selected ? "In progress" : completed ? "Completed" : "Upcoming"}</span></span>
            </button>
          </li>;
        })}
      </ol>
    </nav>
    <div className="grid min-w-0 gap-4 rounded-lg bg-muted/35 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0"><h3 ref={heading} tabIndex={-1} className="text-base font-semibold outline-none">{active.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{active.description}</p></div>
      <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">{active.details.map(detail => <li key={detail} className="flex gap-2"><ChevronRight aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /><span>{detail}</span></li>)}</ul>
    </div>
    {summary}
  </section>;
}

export function WorkflowSummary({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl aria-label="Current selections" className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">{items.map(item => <div key={item.label} className="min-w-0"><dt className="text-[11px] font-medium text-muted-foreground">{item.label}</dt><dd className="mt-1 break-words text-xs font-medium">{item.value}</dd></div>)}</dl>;
}
