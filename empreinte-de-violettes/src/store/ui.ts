"use client";
import { create } from "zustand";

interface UIState {
  introDone: boolean;
  menuOpen: boolean;
  setIntroDone: () => void;
  setMenuOpen: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  introDone: false,
  menuOpen: false,
  setIntroDone: () => set({ introDone: true }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
}));
