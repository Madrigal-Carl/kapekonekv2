import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { PageSpinner } from '@/components/ui/Spinner'
import { homeFor } from '@/constants/roles'
import { useAuth } from '@/hooks/useAuth'
import { safeRedirect } from '@/lib/safeRedirect'
import { Forbidden } from '@/pages/errors/Forbidden'

/** Storefront pages: guests and buyers only; other roles go to their dashboard. */
export function StorefrontRoute() {
  const { isLoading, isAuthenticated, roles, mustChangePassword } = useAuth()
  if (isLoading) return <PageSpinner />
  if (mustChangePassword) return <Navigate to="/set-password" replace />
  if (isAuthenticated && !roles.includes('buyer')) return <Navigate to="/dashboard/overview" replace />
  return <Outlet />
}

/** Login, register, forgot password: signed-in users leave (unverified buyers to verify first). */
export function GuestRoute() {
  const { isLoading, isAuthenticated, mustVerify, mustChangePassword, roles } = useAuth()
  const [params] = useSearchParams()
  if (isLoading) return <PageSpinner />
  if (mustChangePassword) return <Navigate to="/set-password" replace />
  if (isAuthenticated) {
    return <Navigate to={mustVerify ? '/verify-email' : safeRedirect(params.get('redirect'), homeFor(roles))} replace />
  }
  return <Outlet />
}

/**
 * Signed-in pages. Guests go to login and come back; a temporary password is replaced first;
 * unverified buyers and farmers verify first when required.
 * @param {{ roles?: string[], permissions?: string[], requireVerified?: boolean }} props
 */
export function ProtectedRoute({ roles: allowedRoles, permissions: required, requireVerified = false }) {
  const { isLoading, isAuthenticated, mustVerify, mustChangePassword, roles, permissions } = useAuth()
  const location = useLocation()
  if (isLoading) return <PageSpinner />
  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }
  if (mustChangePassword) return <Navigate to="/set-password" replace />
  if (requireVerified && mustVerify) return <Navigate to="/verify-email" replace />
  const roleOk = !allowedRoles || allowedRoles.some((r) => roles.includes(r))
  const permOk = !required || roles.includes('kaluppa') || required.every((p) => permissions.includes(p))
  if (!roleOk || !permOk) return <Forbidden />
  return <Outlet />
}
