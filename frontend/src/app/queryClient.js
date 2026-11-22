import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry network/5xx failures once; a 4xx won't change on retry.
      retry: (count, error) => count < 1 && !(error?.response?.status < 500),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})
