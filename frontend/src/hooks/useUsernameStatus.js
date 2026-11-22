import { useUsernameAvailability } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { USERNAME_RULE, usernameRule } from '@/schemas/rules'

/**
 * Live username status under the field: rule, checking, taken (red) or available (green).
 * `current` is the user's own username (Profile), which counts as fine without a lookup.
 * @returns {{ tone: 'muted'|'taken'|'available', message: string }}
 */
export function useUsernameStatus(username, serverError, { current, takenHint = 'Try a suggestion.' } = {}) {
  const debounced = useDebouncedValue(username, 350)
  const valid = usernameRule.safeParse(debounced).success
  const availability = useUsernameAvailability(debounced, valid && debounced !== current)
  if (serverError) return { tone: 'taken', message: serverError }
  if (current && username === current) return { tone: 'available', message: 'This is your current username' }
  if (!usernameRule.safeParse(username).success) return { tone: 'muted', message: USERNAME_RULE }
  if (debounced !== username || availability.isFetching) return { tone: 'muted', message: `Checking @${username}…` }
  if (availability.data?.available === false) return { tone: 'taken', message: `@${username} is taken. ${takenHint}` }
  if (availability.data?.available) return { tone: 'available', message: `@${username} is available` }
  return { tone: 'muted', message: USERNAME_RULE }
}
