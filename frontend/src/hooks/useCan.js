import { useAuth } from './useAuth'

/** Does the signed-in user hold this permission? Kaluppa always does. */
export function useCan(slug) {
  const { roles, permissions } = useAuth()
  return roles.includes('kaluppa') || permissions.includes(slug)
}
