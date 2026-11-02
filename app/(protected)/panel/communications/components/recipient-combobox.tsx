"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PaginatedCombobox } from "@/components/paginated-combobox";
import { request } from "@/components/http";
import { Button } from "@/components/ui/button";
import { normalizePhone, validPhone } from "@/lib/communications";

type Customer = { id: number; name: string; company_name: string | null; phone_number: string | null; email: string };
type Recipient = Customer & { contact: string };

export function RecipientCombobox({ channel, value, onChange, disabled }: { channel: "phone" | "email"; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [page, setPage] = useState(0), [search, setSearch] = useState("");
  const valid = (input: string) => channel === "phone" ? validPhone(input) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
  const normalize = (input: string) => channel === "phone" ? normalizePhone(input) : input.trim();
  const query = useQuery({
    queryKey: ["communication-recipients", channel, page, search],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ page: String(page), limit: "10", search, contact: channel });
      const response = await fetch(`/api/users/customers?${params}`, { credentials: "include", signal });
      // Reuse session refresh only on an explicit authentication rejection.
      const authenticated = response.status === 401 ? await request("GET", `/api/users/customers?${params}`) : response;
      const data = await authenticated.json().catch(() => null);
      if (!authenticated.ok || !Array.isArray(data?.rows) || typeof data?.total !== "number") throw new Error("Customer contacts could not be loaded. Retry or enter a custom recipient.");
      return data as { rows: Customer[]; total: number };
    },
    retry: 1,
    enabled: !disabled,
  });
  const options: Recipient[] = [];
  for (const customer of query.data?.rows ?? []) {
    const contact = normalize(channel === "phone" ? customer.phone_number ?? "" : customer.email ?? "");
    if (valid(contact) && !options.some(item => item.contact === contact)) options.push({ ...customer, contact });
  }
  return <div className="min-w-0 space-y-2">
    <PaginatedCombobox<Recipient>
      id={`communication-${channel}`} label={channel === "phone" ? "Phone number" : "Recipient email"}
      value={value || null} selectedLabel={value} disabled={disabled}
      options={options} getOptionValue={item => item.contact}
      renderOption={item => <span className="grid min-w-0 gap-0.5"><span className="break-words font-medium">{item.name}{item.company_name ? ` / ${item.company_name}` : ""}</span><span className="break-all text-xs text-muted-foreground">{item.contact}</span></span>}
      onValueChange={next => onChange(next ?? "")}
      getCustomValue={input => valid(input) ? normalize(input) : null}
      onCustomValueChange={onChange}
      onSearchChange={setSearch} page={page} totalPages={Math.ceil((query.data?.total ?? 0) / 10)} onPageChange={setPage}
      isLoading={query.isFetching} placeholder={channel === "phone" ? "Search customers or enter a phone number" : "Search customers or enter an email"}
      emptyMessage="No matching customer contacts. Enter a valid custom recipient to use it."
      error={query.isError ? <div role="alert" className="text-sm text-destructive"><p>{query.error.message}</p><Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>Retry contacts</Button></div> : undefined}
    />
    <p className="text-xs text-muted-foreground">Search by customer name, company, phone or email. To use another recipient, type it and select “Use custom”.</p>
  </div>;
}
