import { create } from 'zustand'

/** Client-only cart UI state: whether the drawer is open. The cart itself lives in TanStack Query. */
export const useCartDrawer = create((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
