import { create } from "zustand";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "staff" | "driver" | "user";
}

interface AuthState {
  user: User | null;
  loading: boolean;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  logout: () =>
    set({
      user: null,
    }),
}));
