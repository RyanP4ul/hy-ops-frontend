import { create } from "zustand";

interface PageState {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export const usePageStore = create<PageState>((set) => ({
  currentPage: "Dashboard",
  setCurrentPage: (page) => set({ currentPage: page }),
}));
