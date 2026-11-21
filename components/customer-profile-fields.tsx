"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, type Control, type UseFormReturn } from "react-hook-form";
import { Search } from "lucide-react";
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroupAddon } from "@/components/ui/input-group";
import { request } from "@/components/http";
import type { emptyCustomerProfile, UserForm } from "@/schema/user";
import type { GeocodeResult } from "@/types/geocode";
import { debounce } from "@/utils/debounce";

type UserTextFieldProps = {
  control: Control<UserForm>;
  name: "name" | "email" | `profile.${keyof typeof emptyCustomerProfile}`;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "number";
  autoComplete?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
};

export function UserTextField({ control, name, label, placeholder, type = "text", autoComplete = "off", required, className, disabled }: UserTextFieldProps) {
  const id = useId();
  return (
    <Controller control={control} name={name} render={({ field, fieldState }) => (
      <Field className={className} data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={id}>
          {label}{required && <span aria-hidden="true" className="text-destructive">*</span>}
        </FieldLabel>
        <Input {...field} value={field.value ?? ""} id={id} type={type} placeholder={placeholder}
          autoComplete={autoComplete} required={required} disabled={disabled} step={type === "number" ? "any" : undefined}
          aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? `${id}-error` : undefined} />
        <FieldError id={`${id}-error`} errors={[fieldState.error]} />
      </Field>
    )} />
  );
}

export function CustomerContactFields({ control, disabled, requirePhone }: {
  control: Control<UserForm>;
  disabled?: boolean;
  requirePhone?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <UserTextField control={control} name="profile.company_name" label="Company name" placeholder="Enter company name" autoComplete="organization" disabled={disabled} />
      <UserTextField control={control} name="profile.phone_number" label="Phone number" placeholder="Enter phone number" type="tel" autoComplete="tel" required={requirePhone} disabled={disabled} />
    </div>
  );
}

function CustomerAddressSearch({ onSelect, disabled }: { onSelect: (result: GeocodeResult) => void; disabled?: boolean }) {
  const id = useId();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const updateSearch = useMemo(() => debounce(setSearch, 500), []);
  useEffect(() => () => updateSearch.cancel(), [updateSearch]);

  const query = useQuery({
    queryKey: ["geocode", search],
    queryFn: async () => {
      const response = await request("GET", `/api/geocode/search?q=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error("Address search is unavailable");
      return await response.json() as GeocodeResult[];
    },
    enabled: !disabled && search.length >= 3,
    retry: false,
  });
  const term = input.trim();
  const searching = !selected && term.length >= 3 && (term !== search || query.isFetching);
  const results = selected ? [selected] : term.length >= 3 && !searching ? query.data ?? [] : [];
  const emptyMessage = term.length < 3 ? "Type at least 3 characters to search."
    : searching ? "Searching for addresses…"
    : query.isError ? "Address search is unavailable. Edit your search or enter the address below."
    : "No addresses found.";

  return (
    <Field>
      <FieldLabel htmlFor={id}>Search Address</FieldLabel>
      <Combobox
        disabled={disabled}
        items={results}
        filter={null}
        value={selected}
        inputValue={input}
        itemToStringLabel={(item) => item.display_name}
        onInputValueChange={(value, { reason }) => {
          if (reason !== "input-change" && reason !== "input-clear" && reason !== "clear-press") return;
          setInput(value);
          setSelected(null);
          updateSearch(value.trim());
        }}
        onValueChange={(item) => {
          if (!item) return;
          updateSearch.cancel();
          setSearch("");
          setSelected(item);
          setInput(item.display_name);
          onSelect(item);
        }}
      >
        <ComboboxInput id={id} className="w-full" placeholder="Search customer address..." maxLength={200}
          disabled={disabled} aria-describedby={`${id}-help`}>
          <InputGroupAddon aria-hidden="true"><Search className="size-4" /></InputGroupAddon>
        </ComboboxInput>
        <ComboboxContent className="z-[60]">
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(item: GeocodeResult) => (
              <ComboboxItem key={item.place_id} value={item} className="whitespace-normal">
                {item.display_name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldDescription id={`${id}-help`}>Choose a result to fill the address, then check the details below.</FieldDescription>
    </Field>
  );
}

export function CustomerAddressFields({ form, disabled, showCoordinates }: {
  form: UseFormReturn<UserForm>;
  disabled?: boolean;
  showCoordinates?: boolean;
}) {
  function selectAddress(result: GeocodeResult) {
    const address = result.address;
    const values = [
      ["profile.address_line", [address.house_number, address.road].filter(Boolean).join(" ") || result.display_name],
      ["profile.barangay", address.suburb ?? address.neighbourhood ?? address.village ?? ""],
      ["profile.city_municipality", address.city ?? address.town ?? address.municipality ?? address.village ?? ""],
      ["profile.province", address.state ?? address.province ?? ""],
      ["profile.postal_code", address.postcode ?? ""],
      ["profile.latitude", result.lat ?? ""],
      ["profile.longitude", result.lon ?? ""],
    ] as const;
    for (const [name, value] of values) {
      form.setValue(name, value, { shouldDirty: true });
    }
    void form.trigger(values.map(([name]) => name));
  }

  const { control } = form;
  return (
    <div className="space-y-4">
      <CustomerAddressSearch onSelect={selectAddress} disabled={disabled} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UserTextField control={control} name="profile.address_line" label="Address" placeholder="Enter address line" autoComplete="street-address" required disabled={disabled} />
        <UserTextField control={control} name="profile.barangay" label="Barangay" placeholder="Enter barangay" required disabled={disabled} />
        <UserTextField control={control} name="profile.city_municipality" label="City/Municipality" placeholder="Enter city or municipality" required disabled={disabled} />
        <UserTextField control={control} name="profile.province" label="Province" placeholder="Enter province" required disabled={disabled} />
        <UserTextField control={control} name="profile.postal_code" label="Postal code" placeholder="Enter postal code" autoComplete="postal-code" disabled={disabled} />
      </div>
      {showCoordinates && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Search fills the delivery coordinates. You can also enter them manually.</p>
          <div className="grid grid-cols-2 gap-3">
            <UserTextField control={control} name="profile.latitude" label="Latitude" type="number" required disabled={disabled} />
            <UserTextField control={control} name="profile.longitude" label="Longitude" type="number" required disabled={disabled} />
          </div>
        </div>
      )}
    </div>
  );
}
