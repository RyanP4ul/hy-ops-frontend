import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Opt } from "../../api/contract";

interface Props { label: string; value: string[]; onChange: (v: string[]) => void; options: Opt[] }

export function MultiSelect({ label, value, onChange, options }: Props) {
  return (
    <Popover>
      <PopoverTrigger render={
        <Button variant="outline" className="w-full justify-between sm:w-48">
          <span className="truncate">{label}{value.length ? ` (${value.length})` : ""}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      } />
      <PopoverContent className="w-60 p-2" align="start">
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
              <Checkbox checked={value.includes(o.value)} onCheckedChange={(c) => onChange(c ? [...value, o.value] : value.filter((x) => x !== o.value))} />
              {o.label}
            </label>
          ))}
          {!options.length && <p className="px-2 py-1.5 text-sm text-muted-foreground">No options</p>}
        </div>
        {value.length > 0 && <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => onChange([])}>Clear</Button>}
      </PopoverContent>
    </Popover>
  );
}
