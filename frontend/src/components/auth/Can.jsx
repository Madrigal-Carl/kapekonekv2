import { useCan } from '@/hooks/useCan'

/** Render children only when the user holds `permission`. */
export function Can({ permission, children, fallback = null }) {
  return useCan(permission) ? children : fallback
}
