import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { setAuthHandlers } from '@/api/axios'
import { router } from '@/routes/AppRouter'
import { useAuthStore } from '@/stores/auth.store'
import { queryClient } from './queryClient'

setAuthHandlers({
  onSessionExpired: () => useAuthStore.getState().clear(),
  onEmailNotVerified: () => router.navigate('/verify-email'),
})
useAuthStore.getState().load()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
