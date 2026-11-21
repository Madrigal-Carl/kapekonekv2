import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

/**
 * Wrap an account-gated action: guests go to login (and come back), unverified buyers verify first.
 * @returns {(fn: () => void) => void}
 */
export function useRequireAuthAction() {
  const { isAuthenticated, mustVerify } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(
    (fn) => {
      if (!isAuthenticated) {
        navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`)
      } else if (mustVerify) {
        navigate('/verify-email')
      } else {
        fn()
      }
    },
    [isAuthenticated, mustVerify, navigate, location.pathname, location.search],
  )
}
