import { useUsernameAvailability } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { USERNAME_RULE, usernameRule } from '@/schemas/rules'

/** react-hook-form `register('username', USERNAME_INPUT)`: keeps the username lowercase as it's typed. */
export const USERNAME_INPUT = { setValueAs: (v) => v.toLowerCase(), onChange: (e) => { e.target.value = e.target.value.toLowerCase() } }

/**
 * Live username status under the field (UsernameField): a hint when empty, ✕ invalid or taken (red), ✓ available (green).
 * `current` is the account's own username (Profile, edit drawers), which counts as fine without a lookup.
 * @returns {{ tone: 'muted'|'taken'|'available', message: string }}
 */
export function useUsernameStatus(username, serverError, { current, currentMessage = 'This is your current username', emptyHint = USERNAME_RULE, takenHint = 'Try a suggestion.' } = {}) {
  const debounced = useDebouncedValue(username, 350)
  const valid = usernameRule.safeParse(debounced).success
  const availability = useUsernameAvailability(debounced, valid && debounced !== current)
  if (serverError) return { tone: 'taken', message: serverError }
  if (current && username === current) return { tone: 'available', message: currentMessage }
  if (!username) return { tone: 'muted', message: emptyHint }
  if (!usernameRule.safeParse(username).success) return { tone: 'taken', message: USERNAME_RULE }
  if (debounced !== username || availability.isFetching) return { tone: 'muted', message: `Checking @${username}…` }
  if (availability.data?.available === false) return { tone: 'taken', message: `@${username} is taken. ${takenHint}` }
  if (availability.data?.available) return { tone: 'available', message: `@${username} is available` }
  return { tone: 'muted', message: USERNAME_RULE }
}
