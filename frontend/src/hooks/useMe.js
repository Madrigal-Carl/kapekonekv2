import { useAuth } from './useAuth'

/** The signed-in person as an author card (`Avatar`): Kaluppa shows as KP, like its posts. */
export function useMe() {
  const { user, roles } = useAuth()
  return { _id: user?.id, initials: roles[0] === 'kaluppa' ? 'KP' : user?.initials, role: roles[0], avatarUrl: user?.avatar?.url ?? null }
}
