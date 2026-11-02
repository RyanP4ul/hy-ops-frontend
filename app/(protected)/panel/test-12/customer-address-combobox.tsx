"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  LoaderCircle,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { GeocodingResult, GeocodingSearchResponse } from "@/types/geocode";

type CustomerAddressComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: GeocodingResult | null) => void;
  placeholder?: string;
  disabled?: boolean;
  bias?: { latitude: number; longitude: number };
};

const DEFAULT_BIAS = { latitude: 14.83, longitude: 120.88 };

export function CustomerAddressCombobox({
  value,
  onChange,
  onSelect,
  placeholder = "Search a delivery address...",
  disabled = false,
  bias = DEFAULT_BIAS,
}: CustomerAddressComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || query.trim().length < 3) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setResults([]);
    setError(null);

    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          lat: String(bias.latitude),
          lon: String(bias.longitude),
        });
        const response = await fetch(
          `/api/geocoding/search?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );
        const payload = (await response.json()) as GeocodingSearchResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Address search failed.");
        }

        setResults(payload.results ?? []);
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setResults([]);
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to search addresses.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [bias.latitude, bias.longitude, open, query]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setQuery("");
      setError(null);
    }
  }

  function handleSelect(result: GeocodingResult) {
    onChange(result.label);
    onSelect(result);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    onSelect(null);
    setQuery("");
    setResults([]);
    setError(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger render={
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="h-11 min-w-0 flex-1 justify-between text-left font-normal"
            >
              <span
                className={cn(
                  "flex min-w-0 items-center gap-2",
                  !value && "text-muted-foreground",
                )}
              >
                <MapPin className="size-4 shrink-0" />
                <span className="truncate">{value || placeholder}</span>
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          } />
          <PopoverContent
            align="start"
            className="w-[min(92vw,520px)] p-0"
            initialFocus={false}
          >
            <Command shouldFilter={false}>
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder="Type a street, building, barangay, or city..."
                aria-label="Search delivery address"
              />
              <CommandList>
                {query.trim().length < 3 ? (
                  <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                    <Search className="size-4" />
                    Enter at least 3 characters to search.
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Searching addresses...
                  </div>
                ) : error ? (
                  <div className="px-4 py-6 text-sm text-destructive">
                    {error}
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      No matching addresses found. Try adding the barangay or
                      municipality.
                    </CommandEmpty>
                    {results.length > 0 && (
                      <CommandGroup heading="Address suggestions">
                        {results.map((result) => (
                          <CommandItem
                            key={result.id}
                            value={result.id}
                            onSelect={() => handleSelect(result)}
                            className="cursor-pointer items-start gap-2 py-3"
                          >
                            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block whitespace-normal font-medium">
                                {result.label}
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {result.latitude.toFixed(6)},{" "}
                                {result.longitude.toFixed(6)}
                              </span>
                            </span>
                            <Check className="mt-0.5 size-4 shrink-0 opacity-0" />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            aria-label="Clear selected address"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">Philippines</Badge>
        <span>Suggestions powered by Photon / OpenStreetMap.</span>
      </div>
    </div>
  );
}
