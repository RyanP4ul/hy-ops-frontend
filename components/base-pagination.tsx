"use client";

import { debounce } from "@/utils/debounce";
import { useMemo, useState } from "react";

export function useComboBoxPagination() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // What the user is currently typing.
  // This updates immediately.
  const [inputValue, setInputValue] = useState("");

  // Debounced value used for API searching.
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchQuery(value);
        setPage(0);
      }, 300),
    [],
  );

  return {
    open,
    setOpen,

    page,
    setPage,

    totalPages,
    setTotalPages,

    inputValue,
    setInputValue,

    searchQuery,
    setSearchQuery,

    debouncedSearch,
  };
}
