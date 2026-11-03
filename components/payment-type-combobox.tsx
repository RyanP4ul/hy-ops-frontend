"use client";

import { useState } from "react";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";

const banks = ["BDO", "BPI", "Metrobank", "Land Bank", "PNB", "RCBC", "Security Bank", "UnionBank", "Chinabank", "EastWest"];
const cards = ["Visa", "Mastercard", "American Express", "JCB", "UnionPay"];

export function PaymentTypeCombobox({ method, value, onChange, onBlur, invalid }: {
  method: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const choices = method === "BANK_TRANSFER" ? banks : cards;
  const query = search.trim().slice(0, 100);
  const options = [...new Set([...choices, ...(value ? [value] : [])])];
  const matches = options.filter(option => option.toLowerCase().includes(query.toLowerCase()));
  const custom = query && !options.some(option => option.toLowerCase() === query.toLowerCase());

  return (
    <Combobox
      filter={null}
      open={open}
      onOpenChange={(nextOpen, details) => {
        setOpen(nextOpen);
        if (!nextOpen || details.reason !== "input-change") setSearch("");
      }}
      value={value || null}
      inputValue={open ? search : value}
      onInputValueChange={setSearch}
      onValueChange={(nextValue) => { onChange(nextValue ?? ""); setOpen(false); setSearch(""); }}
    >
      <ComboboxInput id="payment_type" className="w-full" placeholder={method === "BANK_TRANSFER" ? "Select or enter a bank" : "Select or enter a card type"} maxLength={100} onBlur={onBlur} aria-invalid={invalid} aria-describedby="payment-type-help" />
      <ComboboxContent>
        <ComboboxList>
          {matches.map(option => <ComboboxItem key={option} value={option}>{option}</ComboboxItem>)}
          {custom && <ComboboxItem value={query}>Use custom: {query}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
