"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ArrayFilterKey, Filters, OptionsResponse, Opt } from "../../api/contract";
import { STATIC_FILTERS } from "../../constants";
import { activeFilterLabels } from "../../lib/filters";
import { MultiSelect } from "../common/multi-select";

interface Props {
  filters: Filters;
  options: OptionsResponse;
  onList: (key: ArrayFilterKey) => (v: string[]) => void;
  onOverdueOnly: (v: boolean) => void;
}

/** Collapsible multi-select filters, the "overdue only" switch and badges for whatever is active. */
export function FilterBar({ filters: f, options, onList, onOverdueOnly }: Props) {
  const [open, setOpen] = useState(false);
  const active = activeFilterLabels(f);

  // Dropdowns in display order: dynamic ones come from the API, enum ones are static.
  const dynamic: { key: ArrayFilterKey; label: string; options: Opt[] }[] = [
    { key: "customers", label: "Customer", options: options.customers },
    { key: "products", label: "Product", options: options.products },
    { key: "warehouses", label: "Warehouse", options: options.warehouses },
  ];
  const all = [...dynamic, ...STATIC_FILTERS, { key: "vehicles" as const, label: "Vehicle", options: options.vehicles }];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"} filters{active.length ? ` (${active.length})` : ""}</Button>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.overdueOnly} onCheckedChange={onOverdueOnly} />Overdue only</label>
        {active.map((a) => <Badge key={a} variant="secondary">{a}</Badge>)}
      </div>
      {open && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap">
          {all.map((x) => <MultiSelect key={x.key} label={x.label} value={f[x.key]} onChange={onList(x.key)} options={x.options} />)}
        </div>
      )}
    </div>
  );
}
