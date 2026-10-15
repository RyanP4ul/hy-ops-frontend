"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Button } from "@/components/ui/button";

export type AddressResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;

  address: {
    house_number?: string;
    road?: string;

    neighbourhood?: string;
    suburb?: string;

    village?: string;
    town?: string;
    city?: string;
    municipality?: string;

    province?: string;
    state?: string;

    postcode?: string;

    country?: string;
    country_code?: string;
  };
};

type AddressComboboxProps = {
  value?: string;
  onSelect: (address: AddressResult) => void;
  disabled?: boolean;
};

export function AddressCombobox({
  value = "",
  onSelect,
  disabled = false,
}: AddressComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    if (!open || search.trim().length < 3) {
      setResults([]);
      return;
    }

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/geocode/search?q=${encodeURIComponent(search)}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Failed to search address");
        }

        const data: AddressResult[] = await response.json();

        setResults(data);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className="truncate">
              {value || "Search warehouse address..."}
            </span>

            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        }
      />

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search address..."
            value={search}
            onValueChange={setSearch}
          />

          <CommandList>
            {loading && (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching...
              </div>
            )}

            {!loading && search.length >= 3 && results.length === 0 && (
              <CommandEmpty>No address found.</CommandEmpty>
            )}

            {!loading && results.length > 0 && (
              <CommandGroup heading="Addresses">
                {results.map((result) => (
                  <CommandItem
                    key={result.place_id}
                    value={result.display_name}
                    onSelect={() => {
                      onSelect(result);
                      setSearch(result.display_name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === result.display_name
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />

                    <span className="line-clamp-2">{result.display_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
