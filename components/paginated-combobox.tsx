"use client";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldLabel } from "@/components/ui/field";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type PaginatedComboboxProps<Option> = {
  id: string;
  label: string;
  value: string | null;
  selectedLabel: string;
  options: Option[];
  getOptionValue: (option: Option) => string;
  getOptionDisabled?: (option: Option) => boolean;
  renderOption: (option: Option) => ReactNode;
  onValueChange: (value: string | null, option: Option | null) => void;
  onSearchChange: (search: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  error?: ReactNode;
  placeholder?: string;
  emptyMessage: string;
  getCustomValue?: (input: string) => string | null;
  onCustomValueChange?: (value: string) => void;
};

export function PaginatedCombobox<Option>({
  id,
  label,
  value,
  selectedLabel,
  options,
  getOptionValue,
  getOptionDisabled,
  renderOption,
  onValueChange,
  onSearchChange,
  page,
  totalPages,
  onPageChange,
  isLoading,
  disabled = false,
  required = false,
  invalid = false,
  error,
  placeholder,
  emptyMessage,
  getCustomValue,
  onCustomValueChange,
}: PaginatedComboboxProps<Option>) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSearch = useCallback(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = null;
    }
  }, []);

  useEffect(() => cancelPendingSearch, [cancelPendingSearch]);

  const handleInputValueChange = (search: string) => {
    setSearchText(search);
    onPageChange(0);
    cancelPendingSearch();
    searchTimeout.current = setTimeout(() => {
      onPageChange(0);
      onSearchChange(search);
      searchTimeout.current = null;
    }, 300);
  };

  const handleOpenChange = (nextOpen: boolean, details: { reason: string }) => {
    // Typing opens the popup after the input callback; retain that first search.
    if (nextOpen && details.reason === "input-change") {
      setOpen(true);
      return;
    }
    cancelPendingSearch();
    setOpen(nextOpen);
    setSearchText("");

    if (nextOpen) {
      onPageChange(0);
      onSearchChange("");
    }
  };

  const handleValueChange = (nextValue: string | null) => {
    cancelPendingSearch();
    setSearchText("");
    if (nextValue?.startsWith("__custom__:") && getCustomValue && onCustomValueChange) {
      onCustomValueChange(nextValue.slice("__custom__:".length));
      setOpen(false);
      return;
    }
    const selectedOption =
      options.find((option) => getOptionValue(option) === nextValue) ?? null;
    onValueChange(nextValue, selectedOption);
    setOpen(false);
  };

  const pageCount = Math.max(1, totalPages);
  const customValue = getCustomValue?.(searchText) ?? null;

  return (
    <Combobox
      disabled={disabled}
      filter={null}
      open={open}
      onOpenChange={handleOpenChange}
      value={value}
      inputValue={open ? searchText : selectedLabel}
      onInputValueChange={handleInputValueChange}
      onValueChange={handleValueChange}
    >
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={id}>
          {label}
          {required && <span className="text-destructive">*</span>}
        </FieldLabel>

        <ComboboxInput
          id={id}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid}
        />
        <ComboboxContent>
          <ComboboxList>
            {options.map((option) => {
              const optionValue = getOptionValue(option);
              return (
                <ComboboxItem
                  key={optionValue}
                  value={optionValue}
                  disabled={isLoading || getOptionDisabled?.(option)}
                >
                  {renderOption(option)}
                </ComboboxItem>
              );
            })}

            {isLoading && (
              <div className="px-2 py-1 text-xs text-muted-foreground">
                Loading...
              </div>
            )}

            {customValue && onCustomValueChange && (
              <ComboboxItem value={`__custom__:${customValue}`}>
                <span className="break-all">Use custom: {customValue}</span>
              </ComboboxItem>
            )}

            {!isLoading && options.length === 0 && !customValue && (
              <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
            )}
          </ComboboxList>

          <div className="flex items-center justify-between border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || page <= 0 || isLoading}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>

            <span className="text-muted-foreground text-xs">
              {page + 1} / {pageCount}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || page + 1 >= pageCount || isLoading}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </ComboboxContent>

        {error}
      </Field>
    </Combobox>
  );
}
