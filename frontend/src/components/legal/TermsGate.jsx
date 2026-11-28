import { TermsModal } from '@/components/legal/TermsModal'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { useAcceptTerms } from '@/hooks/useLegal'
import { errorMessage } from '@/lib/applyServerErrors'
import { toast } from 'sonner'

/**
 * The accept step (TermsAccept.dc.html, Change 09): a signed-in user who hasn't agreed to the current terms sees
 * TermsModal in accept mode over whatever page they were going to. Accounts made by Kaluppa or a Group Manager verify
 * their email first, so it waits until then. Agreeing reloads the page's data; Sign out signs out.
 */
export function TermsGate() {
  const { user, isAuthenticated, mustVerify } = useAuth()
  const accept = useAcceptTerms()
  const logout = useLogout()
  const open = isAuthenticated && Boolean(user.mustAcceptTerms) && !mustVerify
  if (!open) return null
  const madeBy = user.createdBy && (user.createdBy.isKaluppa ? 'Kaluppa' : `${user.createdBy.name}, your Group Manager`)
  return (
    <TermsModal
      open
      mode="accept"
      madeBy={madeBy}
      pending={accept.isPending}
      onAgree={(version) => accept.mutate(version, { onError: (error) => toast.error(errorMessage(error)) })}
      onSignOut={() => logout.mutate()}
    />
  )
}
