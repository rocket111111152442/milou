"use client";

import { create } from "zustand";

/** État partagé de l'en-tête (masqué au scroll vers le bas). */
export const useHeaderState = create<{ hidden: boolean; setHidden: (h: boolean) => void }>((set) => ({
  hidden: false,
  setHidden: (hidden) => set({ hidden }),
}));
