"use client";
import { create } from "zustand";

type User = { id: number; name: string; email: string; ca_firm_name?: string; ca_registration_number?: string; ca_place?: string; created_at: string };

type AuthState = {
  user: User | null;
  setUser: (user: User) => void;
  clearAuth: () => void;
};

const getStoredUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  setUser: (user) => {
    if (typeof window !== "undefined") localStorage.setItem("user", JSON.stringify(user));
    set({ user });
  },
  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
    set({ user: null });
  },
}));
