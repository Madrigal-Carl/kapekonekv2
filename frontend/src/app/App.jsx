import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { setAuthHandlers } from '@/api/axios'
import { useRealtime } from '@/hooks/useRealtime'
import { router } from '@/routes/AppRouter'
import { useAuthStore } from '@/stores/auth.store'
import { queryClient } from './queryClient'

setAuthHandlers({
  onSessionExpired: () => useAuthStore.getState().clear(),
  onEmailNotVerified: () => router.navigate('/verify-email'),
  // Change 09: the terms changed (or were never agreed to) mid-session; reload the session so TermsGate opens.
  onTermsRequired: () => {
    const { session, load } = useAuthStore.getState()
    if (session && !session.user.mustAcceptTerms) load()
  },
})
useAuthStore.getState().load()

function Realtime() {
  useRealtime()
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Realtime />
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
