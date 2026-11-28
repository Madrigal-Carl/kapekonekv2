import { create } from 'zustand'

const SKIPPED = 'kk:association-window-skipped'
/** "Skip for now" lasts for this browser session (PHASE-2-SPEC §3.1). Storage may be blocked; then it just reopens. */
export const skippedThisSession = () => {
  try {
    return sessionStorage.getItem(SKIPPED) === '1'
  } catch {
    return false
  }
}

/** The farmer's "Join your association" window: opened on sign-in, from the overview banner or Account settings. */
export const useAssociationWindow = create((set) => ({
  open: false,
  rejection: null,
  /** @param {{ reason: string, by?: string | null } | null} [rejection] the last rejection, shown in the window */
  show: (rejection = null) => set({ open: true, rejection }),
  close: () => {
    try {
      sessionStorage.setItem(SKIPPED, '1')
    } catch {
      // private mode: the window may show again next sign-in
    }
    set({ open: false, rejection: null })
  },
}))
