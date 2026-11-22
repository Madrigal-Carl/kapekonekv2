import { create } from 'zustand'
import { getMe } from '@/services/auth.service'

/** The signed-in session (`/auth/me`). `status` is 'loading' until the first check finishes. */
export const useAuthStore = create((set) => ({
  session: null,
  status: 'loading',
  setSession: (session) => set({ session, status: 'ready' }),
  clear: () => set({ session: null, status: 'ready' }),
  /** Swap in the updated user after a profile change (roles and permissions stay). */
  setUser: (user) => set((s) => (s.session ? { session: { ...s.session, user } } : {})),
  /** Re-read the session from the server (boot, after verifying the email). */
  load: async () => {
    try {
      set({ session: await getMe(), status: 'ready' })
    } catch {
      set({ session: null, status: 'ready' })
    }
  },
}))
