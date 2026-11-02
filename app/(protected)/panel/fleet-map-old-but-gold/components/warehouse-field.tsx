import type { ChangeEvent } from "react";

type WarehouseFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric";
  onChange: (value: string) => void;
};

/** One labelled text input of the warehouse form (keeps the form JSX short). */
export function WarehouseField({
  label,
  value,
  placeholder,
  inputMode,
  onChange,
}: WarehouseFieldProps) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <input
        required
        inputMode={inputMode}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}
