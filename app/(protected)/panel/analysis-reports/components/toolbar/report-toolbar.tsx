"use client";
import { Calendar as CalendarIcon, FileText, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DatePreset, Filters } from "../../api/contract";
import { PRESETS } from "../../constants";
import { ymd } from "../../lib/format";
import { manilaCalendarNow } from "@/utils/date-util";

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  onRefresh: () => void;
  onGenerate: () => void;
}

/** Date range, reset / refresh and the Generate Report button. */
export function ReportToolbar({ filters: f, onChange, onReset, onRefresh, onGenerate }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={f.preset} onValueChange={(v) => onChange({ preset: v as DatePreset })}>
        <SelectTrigger className="w-44" aria-label="Date range"><SelectValue>{PRESETS.find(([value]) => value === f.preset)?.[1]}</SelectValue></SelectTrigger>
        <SelectContent>{PRESETS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>

      {f.preset === "custom" && (
        <Popover>
          <PopoverTrigger render={
            <Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />{f.from && f.to ? `${f.from} to ${f.to}` : f.from ? "Pick an end date" : "Pick dates"}</Button>
          } />
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range" numberOfMonths={2} today={manilaCalendarNow()} disabled={{ after: manilaCalendarNow() }}
              selected={f.from ? { from: new Date(f.from + "T00:00:00"), to: f.to ? new Date(f.to + "T00:00:00") : undefined } : undefined}
              onSelect={(r) => onChange({ from: r?.from ? ymd(r.from) : "", to: r?.to ? ymd(r.to) : "" })}
            />
          </PopoverContent>
        </Popover>
      )}

      <Button variant="outline" onClick={onReset}><RotateCcw className="mr-2 h-4 w-4" />Reset</Button>
      <Button variant="outline" onClick={onRefresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      <Button onClick={onGenerate}><FileText className="mr-2 h-4 w-4" />Generate Report</Button>
    </div>
  );
}
