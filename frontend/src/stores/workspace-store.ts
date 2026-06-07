"use client";
import { create } from "zustand";

type WorkspaceState = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
