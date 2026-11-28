import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as legalService from '@/services/legal.service'
import { useAuthStore } from '@/stores/auth.store'

export const legalKeys = { current: ['legal', 'current'] }

export const useLegal = (enabled = true) => useQuery({ queryKey: legalKeys.current, queryFn: legalService.getCurrentLegal, staleTime: Infinity, enabled })

/** Agree, take the fresh session, then reload everything the gate blocked (403 TERMS_REQUIRED). */
export function useAcceptTerms() {
  const setSession = useAuthStore((s) => s.setSession)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: legalService.acceptTerms,
    onSuccess: (session) => {
      setSession(session)
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'legal' })
    },
  })
}
